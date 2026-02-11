import { fal } from '@fal-ai/client'
import { logger } from '../logger'
import type {
  AIProvider,
  AIProviderConfig,
  TryOnInput,
  TryOnResult,
  AIProviderError,
  AIProviderTimeoutError
} from './types'

// Prompt para el modelo Nano Banana Pro (Gemini 3 Pro Image)
const VIRTUAL_TRYON_PROMPT = "Make the person wear the garment from the second image. Maintain realistic fit, natural draping, proper lighting and shadows. Keep the person's pose, face, and background unchanged. Ensure the clothing looks natural on the person's body."

export class FalProvider implements AIProvider {
  readonly name = 'fal'
  readonly config: AIProviderConfig

  constructor(
    private apiKey: string,
    config?: Partial<AIProviderConfig>
  ) {
    this.config = {
      name: 'fal',
      enabled: true,
      priority: 1,
      timeout: 30000, // 30s
      maxRetries: 2,
      ...config
    }

    // Configurar la API key de FAL
    fal.config({
      credentials: apiKey
    })
  }

  async generate(input: TryOnInput): Promise<TryOnResult> {
    const startTime = Date.now()

    try {
      // Preparar los parámetros MÍNIMOS del modelo según la documentación:
      // Requeridos: prompt (string), image_urls (string[])
      const modelInput: any = {
        prompt: VIRTUAL_TRYON_PROMPT,
        image_urls: [
          input.personImageUrl, // Primera imagen: persona
          input.garmentImageUrl // Segunda imagen: prenda
        ]
      }

      // Añadir seed solo si está definido y es un número
      if (typeof input.seed === 'number' && Number.isFinite(input.seed)) {
        modelInput.seed = input.seed
      }

      console.log('[FAL Provider] Enviando request con parámetros:', {
        model: 'fal-ai/nano-banana-pro/edit',
        prompt: modelInput.prompt.substring(0, 50) + '...',
        image_urls_count: modelInput.image_urls.length,
        image_url_1_type: input.personImageUrl.startsWith('data:') ? 'data_uri' : 'url',
        image_url_2_type: input.garmentImageUrl.startsWith('data:') ? 'data_uri' : 'url',
        num_images: modelInput.num_images,
        seed: modelInput.seed,
        aspect_ratio: modelInput.aspect_ratio,
        output_format: modelInput.output_format,
        resolution: modelInput.resolution
      })

      logger.info('Starting FAL AI generation with Nano Banana Pro', {
        model: 'fal-ai/nano-banana-pro/edit',
        personImageUrl: input.personImageUrl.substring(0, 100),
        garmentImageUrl: input.garmentImageUrl.substring(0, 100)
      })

      // Configurar timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new AIProviderTimeoutError('fal', this.config.timeout)),
          this.config.timeout
        )
      )

      // Usar el modelo correcto: nano-banana-pro/edit
      // Enviar sólo los campos mínimos al modelo para evitar parámetros no documentados
      // Mantener la estructura { input } porque el SDK espera el objeto en 'input'
      const generatePromise = fal.subscribe('fal-ai/nano-banana-pro/edit', {
        input: modelInput,
        logs: true // Activar logs para debugging
      })

      const result = await Promise.race([generatePromise, timeoutPromise]) as any

      logger.info('FAL AI generation response received', {
        hasData: !!result.data,
        hasImages: !!result.data?.images,
        imagesCount: result.data?.images?.length || 0
      })

      // El resultado viene en result.data.images (array)
      if (!result.data || !result.data.images || result.data.images.length === 0) {
        throw new Error('Invalid response from FAL AI - no images generated')
      }

      const generatedImage = result.data.images[0]
      
      if (!generatedImage || !generatedImage.url) {
        throw new Error('Invalid response from FAL AI - no image URL')
      }

      const durationMs = Date.now() - startTime

      logger.info('FAL AI generation completed successfully', {
        durationMs,
        resultUrl: generatedImage.url,
        description: result.data.description || 'No description'
      })

      return {
        imageUrl: generatedImage.url,
        provider: this.name,
        modelUsed: 'nano-banana-pro/edit',
        durationMs,
        cached: false
      }
    } catch (error: any) {
      const durationMs = Date.now() - startTime

      // Capturar detalles del error
      const errorDetails: any = {
        provider: 'fal',
        model: 'nano-banana-pro/edit',
        durationMs,
        message: error?.message || 'Unknown error',
        status: error?.status,
        body: error?.body,
        requestId: error?.requestId
      }

      // Loguear cuerpo completo cuando exista (ayuda con 422 Unprocessable Entity)
      try {
        const bodyStr = error?.body ? JSON.stringify(error.body, null, 2) : 'no body'
        console.error('[FAL Provider] Error detallado:', bodyStr)
      } catch (e) {
        console.error('[FAL Provider] Error al serializar body del error:', e)
      }

      logger.error('FalProvider generation error', error as Error, errorDetails)

      if (error instanceof AIProviderTimeoutError) {
        throw error
      }

      // Si es un error de validación (422), incluir más contexto en el mensaje lanzado
      if (error?.status === 422) {
        const validationMessage = error?.body ? ` - Detalles: ${JSON.stringify(error.body)}` : ''
        throw new Error(
          `FAL AI validation error (422): Los parámetros enviados no son válidos${validationMessage}`
        )
      }

      throw new Error(
        `FAL AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}${error?.body ? ' - ' + JSON.stringify(error.body) : ''}`
      )
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Health check simple: verificar que la API key exista
      if (!this.apiKey || this.apiKey === '') {
        return false
      }

      return true
    } catch {
      return false
    }
  }

  getInfo() {
    return {
      name: this.name,
      status: (this.config.enabled ? 'available' : 'unavailable') as 'available' | 'unavailable',
      model: 'nano-banana-pro/edit',
      avgLatency: undefined, // Podríamos calcular esto con métricas
      errorRate: undefined
    }
  }
}