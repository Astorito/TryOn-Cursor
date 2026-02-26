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
  bottomImageUrl?: string
  prompt?: string
  num_images?: number
  seed?: number
}

export class FalClient {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FAL_KEY;
  }

  private async uploadImage(base64OrUrl: string): Promise<string> {
    if (!base64OrUrl.startsWith('data:')) return base64OrUrl;
    try {
      const matches = base64OrUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) throw new Error('Invalid base64 data URL format');
      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const ext = mimeType.split('/')[1] || 'jpg';
      const tmpPath = path.join(os.tmpdir(), `tryon_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
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
    if (!credentials) throw new Error('FAL_KEY is not configured');
    fal.config({ credentials });

    if (!input.personImageUrl) throw new Error('personImageUrl is required');
    if (!input.garmentImageUrl) throw new Error('garmentImageUrl is required');

    // Upload all images in parallel
    const toUpload = [input.personImageUrl, input.garmentImageUrl];
    if (input.bottomImageUrl) toUpload.push(input.bottomImageUrl);

    console.log('[FalClient] Uploading', toUpload.length, 'images...');
    const uploadedUrls = await Promise.all(toUpload.map(img => this.uploadImage(img)));
    const [personUrl, garmentUrl, bottomUrl] = uploadedUrls;
    console.log('[FalClient] All uploaded OK');

    // Nano Banana Pro: natural language prompt, no trigger words needed
    const hasBottom = !!bottomUrl;
    const prompt = input.prompt || (hasBottom
      ? `This is a virtual try-on task. Take the person in image 1 and dress them in the top garment from image 2 and the bottom garment from image 3. Keep the person's face, hair, skin tone, body, pose, and background completely unchanged. Output a single realistic photo of the person wearing both garments naturally.`
      : `This is a virtual try-on task. Take the person in image 1 and dress them in the garment from image 2. Keep the person's face, hair, skin tone, body, pose, and background completely unchanged. Output a single realistic photo of the person wearing the garment naturally.`
    );

    const image_urls = hasBottom
      ? [personUrl, garmentUrl, bottomUrl]
      : [personUrl, garmentUrl];

    const model = 'fal-ai/nano-banana-2/edit';
    console.log('[FalClient] Calling model:', model, '| images:', image_urls.length);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const falInput: Record<string, any> = {
      prompt,
      image_urls,
      num_images: 1,
      output_format: 'jpeg',
      safety_tolerance: '4',
      aspect_ratio: '3:4',
      resolution: '1K',
      limit_generations: true,
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
            if (key === 'url' && typeof value === 'string' && value.startsWith('http')) return value;
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
        console.error('[FalClient] No image URL in response:', result);
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
      throw new Error(`FAL AI generation failed: ${error && typeof error === 'object' ? JSON.stringify(error) : 'Unknown error'}`);
    }
  }
}