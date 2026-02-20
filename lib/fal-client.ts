import { fal } from '@fal-ai/client'
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface FalGenerationResult {
  imageUrl: string
}

export interface FalGenerationInput {
  personImageUrl: string
  garmentImageUrl: string
  // SeedDream v4 edit options
  prompt?: string
  num_images?: number
  seed?: number
  enhance_prompt_mode?: 'standard' | 'fast'
  enable_safety_checker?: boolean
  image_size?: 'square_hd' | 'square' | 'portrait_4_3' | 'portrait_16_9' | 'landscape_4_3' | 'landscape_16_9' | 'auto' | 'auto_2K' | 'auto_4K'
}

export class FalClient {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FAL_KEY;
  }

  /**
   * Sube una imagen base64 a FAL.ai storage y retorna la URL pública.
   * Si ya es una URL, la retorna directamente.
   */
  private async uploadImage(base64OrUrl: string): Promise<string> {
    if (!base64OrUrl.startsWith('data:')) {
      return base64OrUrl;
    }

    try {
      const matches = base64OrUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) throw new Error('Invalid base64 data URL format');

      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const ext = mimeType.split('/')[1] || 'jpg';

      const tmpPath = path.join(
        os.tmpdir(),
        `tryon_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      );
      fs.writeFileSync(tmpPath, buffer);

      try {
        const file = new File([buffer], `image.${ext}`, { type: mimeType });
        const uploadedUrl = await fal.storage.upload(file);
        return uploadedUrl;
      } finally {
        try { fs.unlinkSync(tmpPath); } catch { /* ignorar */ }
      }
    } catch (error) {
      console.error('[FalClient] Error uploading image:', error);
      throw new Error('Failed to upload image to FAL.ai storage');
    }
  }

  async generate(input: FalGenerationInput): Promise<FalGenerationResult> {
    const credentials = this.apiKey || process.env.FAL_KEY;
    if (!credentials) {
      throw new Error('FAL_KEY is not configured');
    }
    fal.config({ credentials });

    // Subir persona y prenda en paralelo
    console.log('[FalClient] Uploading images to FAL.ai storage...');
    const [personImageUrl, garmentImageUrl] = await Promise.all([
      this.uploadImage(input.personImageUrl),
      this.uploadImage(input.garmentImageUrl),
    ]);
    console.log('[FalClient] Images uploaded:', { personImageUrl, garmentImageUrl });

    const model = 'fal-ai/bytedance/seedream/v4/edit';
    console.log('[FalClient] Calling model:', model);

    // Prompt optimizado para virtual try-on con SeedDream v4
    const prompt = input.prompt || `Virtual try-on task. Image 1 is the person. Image 2 is the garment product shot.

STRICT RULES:
1. PRESERVE the person exactly: face, hair, skin tone, body shape, pose, shoes, background. Do not change anything except clothing.
2. REPLICATE the garment from image 2 with 100% fidelity: exact colors, brand logo, text, stitching, zippers, buttons, patterns and textures. Never invent or substitute any detail of the garment.
3. LAYERING rules based on garment type:
   - JACKET / COAT / PUFFER / OUTERWEAR: place it ON TOP of whatever the person is already wearing. Do NOT remove the clothing underneath. Show it open/unzipped so the underlayer is visible.
   - DRESS / JUMPSUIT / FULL-BODY garment: replace the entire outfit of the person.
   - TOP / SHIRT / BLOUSE / SWEATER: replace only the upper body clothing, keep the lower body as-is.
   - PANTS / SKIRT / SHORTS: replace only the lower body clothing, keep the upper body as-is.
4. Result must look like a single real professional fashion photo, not a collage or composite.`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const falInput: Record<string, any> = {
      prompt,
      image_urls: [personImageUrl, garmentImageUrl],
      num_images: input.num_images ?? 1,
      enhance_prompt_mode: input.enhance_prompt_mode ?? 'standard',
      enable_safety_checker: input.enable_safety_checker ?? true,
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
      ...(input.image_size ? { image_size: input.image_size } : {}),
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await fal.subscribe(model, {
        input: falInput as any,
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            update.logs?.forEach((log) => console.log('[FAL]', log.message));
          }
        },
      }) as {
        data?: { images?: Array<{ url: string }> };
        images?: Array<{ url: string }>;
        image?: { url: string };
      };

      console.log('[FalClient] Response preview:', JSON.stringify(result).substring(0, 500));

      let imageUrl: string | undefined;

      if (result?.data?.images?.[0]?.url) {
        imageUrl = result.data.images[0].url;
      } else if (result?.images?.[0]?.url) {
        imageUrl = result.images[0].url;
      } else if (result?.image?.url) {
        imageUrl = result.image.url;
      } else {
        const findUrl = (obj: Record<string, unknown>): string | undefined => {
          for (const [key, value] of Object.entries(obj)) {
            if (key === 'url' && typeof value === 'string' && value.startsWith('http')) {
              return value;
            }
            if (value && typeof value === 'object') {
              const found = findUrl(value as Record<string, unknown>);
              if (found) return found;
            }
          }
          return undefined;
        };
        imageUrl = findUrl(result as Record<string, unknown>);
      }

      if (!imageUrl) {
        console.error('[FalClient] No image URL found in response:', result);
        throw new Error('Invalid response from FAL AI - no image URL found');
      }

      console.log('[FalClient] Generated image URL:', imageUrl);
      return { imageUrl };

    } catch (error) {
      console.error('[FalClient] Generation error:', error);

      if (error && typeof error === 'object') {
        const e = error as { status?: number; body?: unknown };
        try {
          console.error('[FalClient] Error status:', e.status);
          if (e.body) console.error('[FalClient] Error body:', JSON.stringify(e.body, null, 2));
        } catch { /* ignorar */ }
      }

      if (error instanceof Error) {
        (error as any).__isFalError = true;
        throw error;
      }

      throw new Error(
        `FAL AI generation failed: ${
          error && typeof error === 'object' ? JSON.stringify(error) : 'Unknown error'
        }`
      );
    }
  }
}