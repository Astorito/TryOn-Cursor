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
  seed?: number
  enhance_prompt_mode?: 'standard' | 'fast'
  // fashn/tryon/v1.6 specific options
  model_type?: 'leffa' | 'ootd' | 'idm'              // Default: 'ootd'
  garment_photo_type?: 'auto' | 'flat-lay' | 'model'  // Default: 'auto'
  nsfw_filter?: boolean                                // Default: true
  cover_feet?: boolean                                 // Default: false
  adjust_hands?: boolean                               // Default: false
  restore_background?: boolean                         // Default: false
  restore_clothes?: boolean                            // Default: false
  long_top?: boolean                                   // Default: false
  timestep_spacing?: 'trailing' | 'linear'
  guidance_scale?: number                              // Default: 2.5
  num_inference_steps?: number                         // Default: 50
  output_format?: 'png' | 'jpeg' | 'webp'
}

/**
 * Cliente para interactuar con FAL AI usando fashn/tryon/v1.6
 */
export class FalClient {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FAL_KEY;
  }

  /**
   * Convierte base64 data URL a Buffer y lo sube a FAL.ai storage.
   * Si ya es una URL pública, la retorna directamente.
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

      // Escribir a archivo temporal
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

    const model = 'fal-ai/fashn/tryon/v1.6';
    console.log('[FalClient] Calling model:', model);

    try {
      const result = await fal.subscribe(model, {
        input: {
          model_image: personImageUrl,
          garment_image: garmentImageUrl,
          model_type: input.model_type ?? 'ootd',
          garment_photo_type: input.garment_photo_type ?? 'auto',
          nsfw_filter: input.nsfw_filter ?? true,
          cover_feet: input.cover_feet ?? false,
          adjust_hands: input.adjust_hands ?? false,
          restore_background: input.restore_background ?? false,
          restore_clothes: input.restore_clothes ?? false,
          long_top: input.long_top ?? false,
          guidance_scale: input.guidance_scale ?? 2.5,
          num_inference_steps: input.num_inference_steps ?? 50,
          ...(input.seed !== undefined ? { seed: input.seed } : {}),
          ...(input.output_format ? { output_format: input.output_format } : {}),
          ...(input.timestep_spacing ? { timestep_spacing: input.timestep_spacing } : {}),
        },
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
        output?: { image?: { url: string } };
      };

      console.log('[FalClient] Response preview:', JSON.stringify(result).substring(0, 500));

      let imageUrl: string | undefined;

      if (result?.data?.images?.[0]?.url) {
        imageUrl = result.data.images[0].url;
      } else if (result?.images?.[0]?.url) {
        imageUrl = result.images[0].url;
      } else if (result?.image?.url) {
        imageUrl = result.image.url;
      } else if (result?.output?.image?.url) {
        imageUrl = result.output.image.url;
      } else {
        // Búsqueda recursiva como último recurso
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
