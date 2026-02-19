/**
 * Tipos e interfaces compartidos para todos los AI providers
 */

export interface TryOnInput {
  personImageUrl: string
  garmentImageUrl: string
  seed?: number
}

export interface TryOnResult {
  imageUrl: string
  provider: string
  modelUsed: string
  durationMs: number
  cached?: boolean
}

export interface AIProviderConfig {
  name: string
  enabled: boolean
  priority: number // 1 = primary, 2 = secondary, etc.
  timeout: number // ms
  maxRetries: number
}

/**
 * Interfaz que todos los providers deben implementar
 */
export interface AIProvider {
  readonly name: string
  readonly config: AIProviderConfig

  /**
   * Genera una imagen de try-on
   * @throws Error si falla la generación
   */
  generate(input: TryOnInput): Promise<TryOnResult>

  /**
   * Verifica si el provider está disponible
   * @returns true si puede procesar requests
   */
  healthCheck(): Promise<boolean>

  /**
   * Obtiene info del provider para debugging
   */
  getInfo(): {
    name: string
    status: 'available' | 'unavailable'
    avgLatency?: number
    errorRate?: number
  }
}

/**
 * Configuración del AI Router
 */
export interface AIRouterConfig {
  providers: AIProvider[]
  enableFallback: boolean
  primaryProvider?: string
  maxRetries: number
  timeoutMs: number
}

/**
 * Errores custom
 */
export class AIProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public code: string,
    public retryable: boolean = true
  ) {
    super(message)
    this.name = 'AIProviderError'
  }
}

export class AIProviderTimeoutError extends AIProviderError {
  constructor(provider: string, timeoutMs: number) {
    super(
      `Provider ${provider} timeout after ${timeoutMs}ms`,
      provider,
      'TIMEOUT',
      true
    )
    this.name = 'AIProviderTimeoutError'
  }
}

export class AIProviderUnavailableError extends AIProviderError {
  constructor(provider: string, reason: string) {
    super(
      `Provider ${provider} unavailable: ${reason}`,
      provider,
      'UNAVAILABLE',
      true
    )
    this.name = 'AIProviderUnavailableError'
  }
}