import { fal } from '@fal-ai/client'

export interface FalGenerationResult {
  imageUrl: string
}

export interface FalGenerationInput {
  personImageUrl: string
  garmentImageUrl: string
  prompt?: string
  seed?: number
}

/**
 * Cliente para interactuar con FAL AI.
 * Modelo: fal-ai/nano-banana-2/edit
 * Optimizado para virtual try-on rapido y confiable.
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
   * Verifica que el resultado no sea una de las imagenes de entrada sin modificar.
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

    console.log('[FalClient] Subiendo imagenes...');
    const [personUrl, garmentUrl] = await Promise.all([
      this.uploadImage(input.personImageUrl),
      this.uploadImage(input.garmentImageUrl),
    ]);
    console.log('[FalClient] Imagenes subidas');

    const inputUrls = [personUrl, garmentUrl];

    // Prompt optimizado segun guia oficial de FAL:
    // Instrucciones explicitas al sistema de razonamiento, no sugerencias
    const basePrompt = input.prompt ?? `Take the person from the first image and replace their current clothing with the exact garment shown in the second image.

Requirements:
- The person MUST be wearing the garment from the second image in the output
- Preserve the garment's exact colors, patterns, texture and design
- Keep the person's face, hair, skin, body shape, pose and background unchanged
- Apply realistic fit, draping and wrinkles as if physically wearing it
- The output must be a single photorealistic photo

Do NOT return the original person without clothing changes.`;

    const model = 'fal-ai/nano-banana-2/edit';
    const MAX_ATTEMPTS = 2;

    type FalResponse = {
      data?: { images?: Array<{ url: string }> };
      images?: Array<{ url: string }>;
      image?: { url: string };
    };

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const seed = input.seed ?? Math.floor(Math.random() * 1_000_000);
      const attemptSeed = attempt === 1 ? seed : Math.floor(Math.random() * 1_000_000);

      // Intento 1: thinking_level "minimal" (rapido)
      // Intento 2: thinking_level "high" (mas razonamiento si el primero fallo)
      const thinkingLevel = attempt === 1 ? 'minimal' : 'high';

      console.log(`[FalClient] Intento ${attempt}: seed=${attemptSeed}, thinking=${thinkingLevel}`);

      const result = await fal.subscribe(model, {
        input: {
          prompt: basePrompt,
          image_urls: [personUrl, garmentUrl],
          num_images: 1,
          output_format: 'jpeg',
          safety_tolerance: '4',
          aspect_ratio: 'auto',
          resolution: '0.5K',
          limit_generations: true,
          thinking_level: thinkingLevel,
          seed: attemptSeed,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            update.logs?.forEach((log) => console.log('[FAL]', log.message));
          }
        },
      }) as FalResponse;

      const imageUrl =
        result?.data?.images?.[0]?.url ??
        result?.images?.[0]?.url ??
        result?.image?.url;

      if (!imageUrl) {
        console.warn(`[FalClient] Intento ${attempt}: sin URL en respuesta`);
        if (attempt < MAX_ATTEMPTS) continue;
        throw new Error('FAL AI no devolvio una imagen valida');
      }

      // Validar que no sea la imagen original sin cambios
      if (this.isUnchanged(imageUrl, inputUrls)) {
        console.warn(`[FalClient] Intento ${attempt}: imagen sin cambios detectada`);
        if (attempt < MAX_ATTEMPTS) {
          console.log('[FalClient] Reintentando con thinking_level high...');
          continue;
        }
        throw new Error('No se pudo aplicar la prenda. Intenta con otra imagen.');
      }

      console.log(`[FalClient] Exito en intento ${attempt}`);
      return { imageUrl };
    }

    throw new Error('FAL AI no pudo generar la imagen despues de varios intentos.');
  }
}
