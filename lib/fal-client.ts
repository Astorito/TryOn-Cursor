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

  // Subir imagen a FAL storage (igual que hace el playground)
  private async uploadImageToStorage(imageData: string): Promise<string> {
    // Si ya es una URL de FAL storage, devolverla directamente
    if (imageData.startsWith('https://fal.media')) {
      return imageData;
    }
    
    // Convertir base64 a Blob (compatible con fal.storage.upload)
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    
    const url = await fal.storage.upload(blob) as string;
    console.log(`[FalClient] Imagen subida a FAL storage: ${url}`);
    return url;
  }

  async generate(input: FalGenerationInput): Promise<FalGenerationResult> {
    const credentials = this.apiKey || process.env.FAL_KEY;
    if (!credentials) throw new Error('FAL_KEY no configurada');
    fal.config({ credentials });

    if (!input.personImageUrl) throw new Error('personImageUrl es requerido');
    if (!input.garmentImageUrl) throw new Error('garmentImageUrl es requerido');

    // Subir ambas imagenes a FAL storage (como hace el playground)
    console.log(`[FalClient] Subiendo imagenes a FAL storage...`);
    const [personUrl, garmentUrl] = await Promise.all([
      this.uploadImageToStorage(input.personImageUrl),
      this.uploadImageToStorage(input.garmentImageUrl)
    ]);

    console.log(`[FalClient] personUrl=${personUrl.substring(0, 60)}... garmentUrl=${garmentUrl.substring(0, 60)}...`);

    const model = 'fal-ai/nano-banana-2/edit';
    // Prompt igual al del playground
    const prompt = input.prompt ?? 'Put the garment on the model. Do not change the model or de pose';
    const seed = input.seed ?? Math.floor(Math.random() * 1_000_000);

    console.log(`[FalClient] Llamando ${model} | seed=${seed} | prompt="${prompt}"`);

    type FalResponse = {
      data?: { images?: Array<{ url: string }> };
      images?: Array<{ url: string }>;
      image?: { url: string };
    };

    const result = await fal.subscribe(model, {
      input: {
        prompt,
        image_urls: [personUrl, garmentUrl],
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
