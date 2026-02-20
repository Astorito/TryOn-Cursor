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

    console.log('[FalClient] Uploading images to FAL.ai storage...');
    const [personImageUrl, garmentImageUrl] = await Promise.all([
      this.uploadImage(input.personImageUrl),
      this.uploadImage(input.garmentImageUrl),
    ]);
    console.log('[FalClient] Images uploaded:', { personImageUrl, garmentImageUrl });

    const model = 'fal-ai/bytedance/seedream/v4/edit';
    console.log('[FalClient] Calling model:', model);

    const prompt = input.prompt || `Virtual try-on. Image 1 is the person. Image 2 is the garment.

CRITICAL — BODY PROPORTIONS:
- The person's head, face, body proportions and height must remain IDENTICAL to image 1. Do not resize, shrink or alter the person's anatomy in any way.
- The garment must fit the person's actual body size naturally, as if they are wearing it. Do not make the garment oversized or disproportionate relative to the body.
- The person's head-to-body ratio must stay exactly the same as in image 1.

GARMENT FIDELITY:
- Reproduce the garment from image 2 with 100% accuracy: exact brand logo, colors, stitching, zippers, pockets, patterns and textures. Never invent details.

LAYERING rules:
- JACKET / COAT / PUFFER / OUTERWEAR: place ON TOP of existing clothing. Do NOT remove what is underneath. Show the jacket open/unzipped so the underlayer remains visible.
- DRESS / JUMPSUIT / FULL-BODY: replace the entire outfit.
- TOP / SHIRT / BLOUSE: replace upper body only, keep lower body as-is.
- PANTS / SKIRT / SHORTS: replace lower body only, keep upper body as-is.

PRESERVE exactly: face, hair, skin tone, shoes, background, lighting, pose.
Final result must look like a single natural professional fashion photo.`;

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