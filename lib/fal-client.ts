import { fal } from '@fal-ai/client'

export interface FalGenerationResult {
  imageUrl: string
}

export interface FalGenerationInput {
  personImageUrl: string
  garmentImageUrl: string
  category?: 'tops' | 'bottoms' | 'one-pieces'
  prompt?: string
  seed?: number
}

/**
 * Cliente para interactuar con FAL AI.
 * Usa fal-ai/fashn/tryon — modelo dedicado de virtual try-on.
 */
export class FalClient {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FAL_KEY;
  }

  /**
   * Sube una imagen base64 a FAL.ai storage y devuelve una URL pública.
   * Si ya es una URL (http/https), la devuelve sin cambios.
   */
  private async uploadImage(base64OrUrl: string): Promise<string> {
    if (!base64OrUrl.startsWith('data:')) return base64OrUrl;

    const matches = base64OrUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) throw new Error('Formato de imagen base64 inválido');

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const ext = mimeType.split('/')[1] || 'jpg';
    const file = new File([buffer], `image.${ext}`, { type: mimeType });

    const uploadedUrl = await fal.storage.upload(file);
    return uploadedUrl;
  }

  async generate(input: FalGenerationInput): Promise<FalGenerationResult> {
    const credentials = this.apiKey || process.env.FAL_KEY;
    if (!credentials) throw new Error('FAL_KEY no configurada');
    fal.config({ credentials });

    if (!input.personImageUrl) throw new Error('personImageUrl es requerido');
    if (!input.garmentImageUrl) throw new Error('garmentImageUrl es requerido');

    console.log('[FalClient] Subiendo imágenes...');
    const [personUrl, garmentUrl] = await Promise.all([
      this.uploadImage(input.personImageUrl),
      this.uploadImage(input.garmentImageUrl),
    ]);
    console.log('[FalClient] Imágenes subidas OK');

    const model = 'fal-ai/fashn/tryon';
    const category = input.category ?? 'tops';

    console.log('[FalClient] Llamando modelo:', model, '| category:', category);

    type FalResponse = {
      data?: { images?: Array<{ url: string }> };
      images?: Array<{ url: string }>;
    };

    const result = await fal.subscribe(model, {
      input: {
        model_image_url: personUrl,
        garment_image_url: garmentUrl,
        category,
        // Opciones de calidad
        garment_photo_type: 'auto',
        nsfw_filter: true,
        ...(input.seed ? { seed: input.seed } : {}),
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          update.logs?.forEach((log) => console.log('[FAL]', log.message));
        }
      },
    }) as FalResponse;

    console.log('[FalClient] Respuesta:', JSON.stringify(result).substring(0, 300));

    const imageUrl =
      result?.data?.images?.[0]?.url ??
      result?.images?.[0]?.url;

    if (!imageUrl) {
      console.error('[FalClient] Sin URL en respuesta:', result);
      throw new Error('FAL AI no devolvió una imagen válida');
    }

    console.log('[FalClient] URL generada:', imageUrl);
    return { imageUrl };
  }
}
