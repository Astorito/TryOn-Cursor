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

export class FalClient {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FAL_KEY;
  }

  async generate(input: FalGenerationInput): Promise<FalGenerationResult> {
    const credentials = this.apiKey || process.env.FAL_KEY;
    if (!credentials) throw new Error('FAL_KEY no configurada');
    fal.config({ credentials });

    if (!input.personImageUrl) throw new Error('personImageUrl es requerido');
    if (!input.garmentImageUrl) throw new Error('garmentImageUrl es requerido');

    // Pasar las imagenes tal cual llegan (base64 o URL) — FAL acepta data URIs directamente
    // Esto es lo mismo que hace el playground: sin subir a storage primero
    const personImg = input.personImageUrl;
    const garmentImg = input.garmentImageUrl;

    console.log(`[FalClient] person=${personImg.startsWith('data:') ? 'base64' : 'url'}(${personImg.length}) garment=${garmentImg.startsWith('data:') ? 'base64' : 'url'}(${garmentImg.length})`);

    const model = 'fal-ai/nano-banana-2/edit';
    const prompt = input.prompt ?? 'Put the garment on the model';
    const seed = input.seed ?? Math.floor(Math.random() * 1_000_000);

    console.log(`[FalClient] Llamando ${model} | seed=${seed}`);

    type FalResponse = {
      data?: { images?: Array<{ url: string }> };
      images?: Array<{ url: string }>;
      image?: { url: string };
    };

    const result = await fal.subscribe(model, {
      input: {
        prompt,
        image_urls: [personImg, garmentImg],
        num_images: 1,
        output_format: 'jpeg',
        safety_tolerance: '4',
        aspect_ratio: 'auto',
        resolution: '1K',
        seed,
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
      result?.images?.[0]?.url ??
      result?.image?.url;

    if (!imageUrl) {
      throw new Error('FAL AI no devolvio una imagen valida');
    }

    console.log('[FalClient] Imagen generada OK');
    return { imageUrl };
  }
}
