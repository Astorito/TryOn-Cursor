import { fal } from '@fal-ai/client'

export interface FalGenerationResult {
  imageUrl: string
}

export interface FalGenerationInput {
  personImageUrl: string
  garmentImageUrl: string
  seed?: number
  prompt?: string
  negative_prompt?: string
  strength?: number
  guidance_scale?: number
  num_inference_steps?: number
  output_format?: string
}

/**
 * Cliente para interactuar con FAL AI
 */
export class FalClient {
  constructor(private apiKey: string) {}

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
      if (this.apiKey) {
        fal.config({ credentials: this.apiKey });
      }

      // Subir imágenes base64 a FAL.ai storage primero
      console.log('Uploading images to FAL.ai storage...');
      const personImageUrl = await this.uploadImage(input.personImageUrl);
      const garmentImageUrl = await this.uploadImage(input.garmentImageUrl);
      console.log('Images uploaded successfully');

      // Usar modelo Gemini-3-pro-image-preview/edit según especificación
      const model = 'fal-ai/gemini-3-pro-image-preview/edit';

      const PROMPT_DEFAULT =
        "Place the garment from the second image onto the person in the first image, maintaining realistic fit, natural draping, and proper lighting. Keep the person's pose and background unchanged.";
      const NEGATIVE_DEFAULT =
        "deformed, distorted, disfigured, poor quality, blurry, unrealistic proportions, bad anatomy, wrong clothing placement, floating clothes";

      const result = await fal.subscribe(model, {
        input: {
          image_url: personImageUrl,
          image_url_2: garmentImageUrl,
          prompt: input.prompt || PROMPT_DEFAULT,
          negative_prompt: input.negative_prompt || NEGATIVE_DEFAULT,
          strength: typeof input.strength === 'number' ? input.strength : 0.65,
          guidance_scale: typeof input.guidance_scale === 'number' ? input.guidance_scale : 7.0,
          num_inference_steps: typeof input.num_inference_steps === 'number' ? input.num_inference_steps : 20,
          output_format: input.output_format || 'jpeg',
          seed: input.seed || Math.floor(Math.random() * 1000000),
        },
        logs: true,
      });

      // Expected response: result.images[0].url
      if (!result || !result.images || !result.images[0] || !result.images[0].url) {
        // Fallback: some SDKs may put data in result.data.image.url
        const alt = result && (result.data?.image?.url || result.data?.image);
        if (alt) {
          return { imageUrl: alt };
        }
        throw new Error('Invalid response from FAL AI');
      }

      return {
        imageUrl: result.images[0].url
      }
    } catch (error) {
      console.error('FAL AI error:', error)
      throw new Error(`FAL AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}