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
  guidance_scale?: number
  output_format?: 'jpeg' | 'png'
  safety_tolerance?: '1' | '2' | '3' | '4' | '5' | '6'
  aspect_ratio?: '21:9' | '16:9' | '4:3' | '3:2' | '1:1' | '2:3' | '3:4' | '9:16' | '9:21'
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
        try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
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

    // Validate inputs
    if (!input.personImageUrl) throw new Error('personImageUrl is required');
    if (!input.garmentImageUrl) throw new Error('garmentImageUrl is required');

    console.log('[FalClient] Uploading images to FAL.ai storage...');
    console.log('[FalClient] personImageUrl type:', input.personImageUrl.startsWith('data:') ? 'base64' : 'url', '- length:', input.personImageUrl.length);
    console.log('[FalClient] garmentImageUrl type:', input.garmentImageUrl.startsWith('data:') ? 'base64' : 'url', '- length:', input.garmentImageUrl.length);

    const [personImageUrl, garmentImageUrl] = await Promise.all([
      this.uploadImage(input.personImageUrl),
      this.uploadImage(input.garmentImageUrl),
    ]);

    if (!personImageUrl || !personImageUrl.startsWith('http')) throw new Error('Failed to upload person image');
    if (!garmentImageUrl || !garmentImageUrl.startsWith('http')) throw new Error('Failed to upload garment image');

    console.log('[FalClient] Images uploaded OK:', { personImageUrl, garmentImageUrl });

    const model = 'fal-ai/flux-pro/kontext/max/multi';
    console.log('[FalClient] Calling model:', model);

    // Kontext/multi: image_urls[0] = person to edit, image_urls[1] = garment reference
    const prompt = input.prompt || `The first image shows a person. The second image shows a garment. Edit the first image so the person is wearing the garment from the second image. Keep the person's face, body, pose, background and shoes exactly the same. Only change the clothing.`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const falInput: Record<string, any> = {
      prompt,
      image_urls: [personImageUrl, garmentImageUrl],
      guidance_scale: input.guidance_scale ?? 2.5,
      num_images: input.num_images ?? 1,
      output_format: input.output_format ?? 'jpeg',
      enhance_prompt: true,
      safety_tolerance: input.safety_tolerance ?? '2',
      aspect_ratio: input.aspect_ratio ?? '3:4',
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
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
        } catch { /* ignore */ }
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