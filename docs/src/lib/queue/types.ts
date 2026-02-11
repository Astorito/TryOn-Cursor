/**
 * Tipos e interfaces para el sistema de colas BullMQ
 */

export interface GenerationJobData {
  jobId: string
  clientId: string
  personImageUrl: string
  garmentUrls: string[]
  apiKey: string
  requestedAt: Date
  priority: number // Basado en tier del cliente (1=enterprise, 5=pro, 10=starter, 20=free)
}

export interface GenerationJobResult {
  resultUrl: string
  provider: string
  modelUsed: string
  durationMs: number
  cached?: boolean
  persistedToR2?: boolean
}

export interface JobStatus {
  jobId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number // 0-100
  resultUrl?: string
  error?: string
  queuedAt: Date
  startedAt?: Date
  completedAt?: Date
  failedAt?: Date
  attemptsMade: number
  attemptsRemaining: number
  priority: number
}

// Configuración de prioridades por tier
export const TIER_PRIORITIES = {
  enterprise: 1,   // Máxima prioridad
  pro: 5,
  starter: 10,
  free: 20         // Mínima prioridad
} as const

export type TierName = keyof typeof TIER_PRIORITIES

// Función helper para obtener prioridad por tier
export function getPriorityForTier(tier: string): number {
  const priorities = Object.entries(TIER_PRIORITIES)
  const found = priorities.find(([key]) => key === tier)

  return found ? found[1] : TIER_PRIORITIES.free
}

// Función helper para obtener tier por prioridad
export function getTierForPriority(priority: number): TierName {
  const priorities = Object.entries(TIER_PRIORITIES) as [TierName, number][]

  // Encontrar el tier más cercano (prioridad más baja o igual)
  for (const [tier, tierPriority] of priorities) {
    if (priority <= tierPriority) {
      return tier
    }
  }

  return 'free'
}

// Configuración de reintentos
export interface RetryConfig {
  attempts: number
  backoff: {
    type: 'exponential' | 'fixed'
    delay: number
  }
}

// Configuración por defecto para jobs de generación
export const DEFAULT_JOB_CONFIG = {
  attempts: parseInt(process.env.QUEUE_MAX_RETRIES || '3'),
  backoff: {
    type: 'exponential' as const,
    delay: 2000 // 2 segundos base
  },
  removeOnComplete: parseInt(process.env.QUEUE_REMOVE_COMPLETED || '100'),
  removeOnFail: parseInt(process.env.QUEUE_REMOVE_FAILED || '1000')
}

// Tipos para métricas de jobs
export interface JobMetrics {
  jobId: string
  clientId: string
  queueTimeMs: number // Tiempo desde creación hasta procesamiento
  processingTimeMs: number // Tiempo de procesamiento AI
  totalTimeMs: number // Tiempo total end-to-end
  attempt: number // Número de intento (1, 2, 3...)
  provider: string
  model: string
  status: 'success' | 'failed'
  error?: string
  createdAt: Date
}