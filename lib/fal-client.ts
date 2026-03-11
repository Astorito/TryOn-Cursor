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
 * Modelo: fal-ai/nano-banana-2/edit
 * Multi-image editor — recibe [persona, prenda] y genera el try-on.
 */
export class FalClient {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FAL_KEY;
  }

  private async uploadImage(base64OrUrl: string): Promise<string> {
    if (!base64OrUrl.startsWith('data:')) return base64OrUrl;

    const matches = base64OrUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) throw new Error('Formato de imagen base64 inválido');

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const ext = mimeType.split('/')[1] || 'jpg';
    const file = new File([buffer], `image.${ext}`, { type: mimeType });

    return await fal.storage.upload(file);
  }

  /**
   * Verifica que el resultado no sea una de las imágenes de entrada sin modificar.
   * Compara la URL resultante contra las URLs de entrada (misma URL = sin cambios).
   */
  private isUnchanged(resultUrl: string, inputUrls: string[]): boolean {
    return inputUrls.some(u => u === resultUrl);
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
    console.log('[FalClient] Imágenes subidas:', { personUrl: personUrl.slice(0, 60), garmentUrl: garmentUrl.slice(0, 60) });

    const inputUrls = [personUrl, garmentUrl];

    // Prompt optimizado para nano-banana-2:
    // - Identifica explícitamente IMAGE 1 e IMAGE 2
    // - Ordena reemplazar, no sugerir
    // - Prohíbe explícitamente devolver la imagen sin cambios
    const prompt = input.prompt ?? `
You are performing a virtual clothing try-on task using two images.
IMAGE 1 is a photo of a PERSON.
IMAGE 2 is a GARMENT (clothing item, flat lay or product photo).

YOUR TASK:
- Remove the clothing the person is currently wearing
- Dress the person in the EXACT garment shown in IMAGE 2
- The garment must visibly and clearly replace the current clothing on the person's body
- Preserve the garment's colors, patterns, logos, and texture exactly as shown in IMAGE 2
- Maintain the person's face, hair, skin tone, body shape, pose, and background UNCHANGED
- Apply realistic draping, wrinkles, and fit as if the person is actually wearing it
- Output a single photorealistic image of the person wearing the garment from IMAGE 2

CRITICAL: Do NOT output the original person unchanged. Do NOT output the garment alone. The output MUST be the person wearing the garment from IMAGE 2.
    `.trim();

    const model = 'fal-ai/nano-banana-2/edit';
    const seed = input.seed ?? Math.floor(Math.random() * 1_000_000);

    console.log('[FalClient] Llamando modelo:', model, '| seed:', seed);

    type FalResponse = {
      data?: { images?: Array<{ url: string }> };
      images?: Array<{ url: string }>;
      image?: { url: string };
    };

    const MAX_ATTEMPTS = 2;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const attemptSeed = attempt === 1 ? seed : Math.floor(Math.random() * 1_000_000);

      const result = await fal.subscribe(model, {
        input: {
          prompt,
          image_urls: [personUrl, garmentUrl],
          num_images: 1,
          output_format: 'jpeg',
          safety_tolerance: '4',
          aspect_ratio: '3:4',
          resolution: '1K',
          seed: attemptSeed,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            update.logs?.forEach((log) => console.log('[FAL]', log.message));
          }
        },
      }) as FalResponse;

      console.log('[FalClient] Respuesta (intento', attempt, '):', JSON.stringify(result).substring(0, 300));

      const imageUrl =
        result?.data?.images?.[0]?.url ??
        result?.images?.[0]?.url ??
        result?.image?.url;

      if (!imageUrl) {
        if (attempt < MAX_ATTEMPTS) {
          console.warn('[FalClient] Sin URL en respuesta, reintentando...');
          continue;
        }
        console.error('[FalClient] Sin URL en respuesta final:', result);
        throw new Error('FAL AI no devolvió una imagen válida');
      }

      // Validar que no sea una imagen de entrada sin modificar
      if (this.isUnchanged(imageUrl, inputUrls)) {
        if (attempt < MAX_ATTEMPTS) {
          console.warn('[FalClient] Imagen sin cambios detectada (misma URL), reintentando con seed diferente...');
          continue;
        }
        throw new Error('FAL AI devolvió la imagen original sin aplicar el garment. Intentá con una imagen diferente.');
      }

      console.log('[FalClient] URL generada (intento', attempt, '):', imageUrl);
      return { imageUrl };
    }

    throw new Error('FAL AI no pudo generar una imagen modificada después de varios intentos.');
  }
}
