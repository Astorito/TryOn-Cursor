import { fal } from '@fal-ai/client'

export interface FalGenerationResult {
  imageUrl: string
}

export interface FalGenerationInput {
  personImageUrl: string
  garmentImageUrl: string
  prompt?: string
  seed?: number
  enhance_prompt_mode?: 'standard' | 'fast'
  num_images?: number
  image_size?: 'square_hd' | 'square' | 'portrait_4_3' | 'portrait_16_9' | 'landscape_4_3' | 'landscape_16_9'
  // Flux 2 LoRA Gallery Virtual Try-On specific options
  guidance_scale?: number // Default: 2.5
  num_inference_steps?: number // Default: 30
  acceleration?: 'none' | 'regular' // Default: 'regular'
  enable_safety_checker?: boolean // Default: true
  output_format?: 'png' | 'jpeg' | 'webp' // Default: 'png'
  lora_scale?: number // Default: 1
}

/**
 * Cliente para interactuar con FAL AI usando Flux 2 LoRA Gallery Virtual Try-On
 */
export class FalClient {
  private apiKey?: string;
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FAL_KEY;
  }

  /**
   * Convierte base64 data URL a Blob
   */
  private base64ToBlob(base64: string): Blob {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1] || 'image/jpeg';
    const raw = atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    
    return new Blob([uInt8Array], { type: contentType });
  }

  /**
   * Sube una imagen base64 a FAL.ai y obtiene una URL
   */
  private async uploadImage(base64: string): Promise<string> {
    try {
      // Si ya es una URL (no es base64), retornarla directamente
      if (!base64.startsWith('data:')) {
        return base64;
      }

      const blob = this.base64ToBlob(base64);
      const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
      
      const uploadedUrl = await fal.storage.upload(file);
      return uploadedUrl;
    } catch (error) {
      console.error('Error uploading image to FAL:', error);
      throw new Error('Failed to upload image to FAL.ai storage');
    }
  }

  async generate(input: FalGenerationInput): Promise<FalGenerationResult> {
    try {
      // Configurar credenciales
      const credentials = this.apiKey || process.env.FAL_KEY;
      if (credentials) {
        fal.config({ credentials });
      }

      // Subir imágenes base64 a FAL.ai storage en paralelo para ahorrar tiempo
      console.log('Uploading images to FAL.ai storage...');
      const [personImageUrl, garmentImageUrl] = await Promise.all([
        this.uploadImage(input.personImageUrl),
        this.uploadImage(input.garmentImageUrl)
      ]);
      console.log('Images uploaded successfully');
      console.log('Person image URL:', personImageUrl);
      console.log('Garment image URL:', garmentImageUrl);

      // Modelo Flux 2 LoRA Gallery Virtual Try-On - Virtual clothing try-on
      const model = 'fal-ai/flux-2-lora-gallery/virtual-tryon';

      console.log('Calling FAL AI with model:', model);
      console.log('Image URLs:', { person: personImageUrl, garment: garmentImageUrl });

      // Preparar el prompt por defecto
      const prompt = input.prompt || 'A person wearing a stylish outfit, virtual try-on';

      // Flux 2 LoRA Gallery Virtual Try-On API expects `image_urls` array and prompt
      const result = await fal.subscribe(model, {
        input: {
          image_urls: [personImageUrl, garmentImageUrl],
          prompt: prompt,
          guidance_scale: input.guidance_scale ?? 2.5,
          num_inference_steps: input.num_inference_steps ?? 30,
          acceleration: input.acceleration || 'regular',
          enable_safety_checker: input.enable_safety_checker ?? true,
          output_format: input.output_format || 'png',
          num_images: input.num_images ?? 1,
          lora_scale: input.lora_scale ?? 1,
          ...(input.seed !== undefined ? { seed: input.seed } : {}),
          ...(input.image_size ? { image_size: input.image_size } : {}),
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            update.logs?.map((log) => log.message).forEach(console.log);
          }
        },
      }) as { data?: { images?: Array<{ url: string }> }; images?: Array<{ url: string }>; image?: { url: string } };

      console.log('FAL AI raw response:', JSON.stringify(result, null, 2).substring(0, 500));

      // Manejar diferentes estructuras de respuesta
      let imageUrl: string | undefined;
      
      if (result?.data?.images?.[0]?.url) {
        imageUrl = result.data.images[0].url;
      } else if (result?.images?.[0]?.url) {
        imageUrl = result.images[0].url;
      } else if (result?.image?.url) {
        imageUrl = result.image.url;
      } else if (typeof result === 'object' && result !== null) {
        // Buscar recursivamente una URL de imagen
        const findImageUrl = (obj: Record<string, unknown>): string | undefined => {
          for (const [key, value] of Object.entries(obj)) {
            if (key === 'url' && typeof value === 'string' && value.startsWith('http')) {
              return value;
            }
            if (typeof value === 'object' && value !== null) {
              const found = findImageUrl(value as Record<string, unknown>);
              if (found) return found;
            }
          }
          return undefined;
        };
        imageUrl = findImageUrl(result as Record<string, unknown>);
      }

      if (!imageUrl) {
        console.error('No image URL found in response:', result);
        throw new Error('Invalid response from FAL AI - no image URL found');
      }

      console.log('Generated image URL:', imageUrl);
      return { imageUrl };
      
    } catch (error) {
      console.error('FAL AI error:', error);
      // Log más detalles del error
      if (error && typeof error === 'object') {
        const e = error as { status?: number; body?: unknown; message?: string };
        try {
          console.error('Error details - Status:', e.status, 'Body:', JSON.stringify(e.body, null, 2));
        } catch (jsonErr) {
          console.error('Could not stringify error body', jsonErr);
        }
      }
      // Propagar el error original cuando sea posible para que el handler pueda inspeccionarlo
      if (error instanceof Error) {
        // marcar para debugging
        (error as any).__isFalError = true;
        throw error;
      }
      throw new Error(`FAL AI generation failed: ${error && typeof error === 'object' ? JSON.stringify(error) : 'Unknown error'}`);
    }
  }
}