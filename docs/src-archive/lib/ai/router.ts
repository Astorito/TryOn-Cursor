import type {
  AIProvider,
  AIRouterConfig,
  TryOnInput,
  TryOnResult
} from './types'

/**
 * Router que maneja múltiples providers con fallback automático
 * Versión simplificada: solo FAL por ahora
 */
export class AIRouter {
  private providers: AIProvider[]
  private config: AIRouterConfig

  constructor(config: AIRouterConfig) {
    this.config = config
    this.providers = config.providers.sort((a, b) =>
      a.config.priority - b.config.priority
    )
  }

  /**
   * Genera una imagen usando el provider principal
   * Versión simplificada: solo FAL, sin fallback por ahora
   */
  async generate(input: TryOnInput): Promise<TryOnResult> {
    // Por ahora solo usar el provider principal (FAL)
    const primaryProvider = this.getPrimaryProvider()

    if (!primaryProvider) {
      throw new Error('No AI providers available')
    }

    if (!primaryProvider.config.enabled) {
      throw new Error(`Primary provider ${primaryProvider.name} is disabled`)
    }

    try {
      console.log(`[AIRouter] Generating with ${primaryProvider.name}`)

      // Health check antes de intentar
      const isHealthy = await primaryProvider.healthCheck()
      if (!isHealthy) {
        throw new Error(`Provider ${primaryProvider.name} health check failed`)
      }

      // Intentar generación
      const result = await primaryProvider.generate(input)

      console.log(
        `[AIRouter] Success with ${primaryProvider.name} in ${result.durationMs}ms`
      )

      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      console.error(`[AIRouter] Provider ${primaryProvider.name} failed:`, err.message)

      throw new Error(
        `AI generation failed: ${err.message}`
      )
    }
  }

  /**
   * Obtiene el estado de todos los providers
   */
  async getProvidersStatus() {
    const statuses = await Promise.all(
      this.providers.map(async (provider) => {
        const isHealthy = await provider.healthCheck()
        return {
          ...provider.getInfo(),
          healthy: isHealthy,
          priority: provider.config.priority
        }
      })
    )

    return statuses
  }

  /**
   * Obtiene el provider principal configurado
   */
  getPrimaryProvider(): AIProvider | null {
    return this.providers.find(p => p.config.priority === 1) || null
  }

  /**
   * Método preparado para agregar más providers después
   */
  addProvider(provider: AIProvider): void {
    this.providers.push(provider)
    this.providers.sort((a, b) => a.config.priority - b.config.priority)
  }
}