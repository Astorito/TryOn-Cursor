import { Queue } from 'bullmq'
import type { GenerationJobData, JobStatus, DEFAULT_JOB_CONFIG } from './types'
import { queueConnection } from './connection'

/**
 * Cola BullMQ para jobs de generación de TryOn
 *
 * Características:
 * - Persistencia en Redis
 * - Reintentos automáticos
 * - Prioridades por tier de cliente
 * - Métricas de rendimiento
 */

export class GenerationQueue {
  private queue: Queue<GenerationJobData>

  constructor() {
    this.queue = new Queue<GenerationJobData>('tryon-generation', {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: DEFAULT_JOB_CONFIG.attempts,
        backoff: DEFAULT_JOB_CONFIG.backoff,
        removeOnComplete: DEFAULT_JOB_CONFIG.removeOnComplete,
        removeOnFail: DEFAULT_JOB_CONFIG.removeOnFail,
        priority: 10, // Default priority (puede ser sobreescrito)
      }
    })

    console.log('[GenerationQueue] Initialized with Redis connection')
  }

  /**
   * Agregar un job de generación a la cola
   */
  async addGenerationJob(data: GenerationJobData): Promise<string> {
    try {
      const job = await this.queue.add(
        'generate-tryon',
        data,
        {
          jobId: data.jobId,
          priority: data.priority,
          timestamp: data.requestedAt.getTime(),
        }
      )

      console.log(`[GenerationQueue] Job ${data.jobId} added to queue with priority ${data.priority}`)
      return job.id
    } catch (error) {
      console.error('[GenerationQueue] Failed to add job:', error)
      throw new Error('Failed to queue generation job')
    }
  }

  /**
   * Obtener estado de un job específico
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    try {
      const job = await this.queue.getJob(jobId)

      if (!job) {
        return null
      }

      const state = await job.getState()
      const progress = job.progress as number || 0
      const attemptsMade = job.attemptsMade || 0
      const opts = job.opts

      let status: JobStatus['status']
      switch (state) {
        case 'waiting':
        case 'delayed':
          status = 'queued'
          break
        case 'active':
          status = 'processing'
          break
        case 'completed':
          status = 'completed'
          break
        case 'failed':
          status = 'failed'
          break
        default:
          status = 'queued'
      }

      const result = await job.getChildrenValues()

      return {
        jobId: job.id!,
        status,
        progress,
        resultUrl: result?.resultUrl,
        error: job.failedReason,
        queuedAt: new Date(job.timestamp),
        startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
        completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
        failedAt: job.failedReason ? new Date(job.finishedOn || Date.now()) : undefined,
        attemptsMade,
        attemptsRemaining: Math.max(0, (opts?.attempts || 1) - attemptsMade),
        priority: opts?.priority || 10
      }
    } catch (error) {
      console.error(`[GenerationQueue] Failed to get job status for ${jobId}:`, error)
      return null
    }
  }

  /**
   * Obtener resultado de un job completado
   */
  async getJobResult(jobId: string): Promise<any> {
    try {
      const job = await this.queue.getJob(jobId)

      if (!job) {
        return null
      }

      const state = await job.getState()
      if (state !== 'completed') {
        return null
      }

      return await job.getChildrenValues()
    } catch (error) {
      console.error(`[GenerationQueue] Failed to get job result for ${jobId}:`, error)
      return null
    }
  }

  /**
   * Obtener estadísticas de la cola
   */
  async getQueueStats() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaiting(),
        this.queue.getActive(),
        this.queue.getCompleted(),
        this.queue.getFailed(),
        this.queue.getDelayed()
      ])

      const counts = await this.queue.getJobCounts()

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        total: counts.waiting + counts.active + counts.completed + counts.failed + counts.delayed,
        counts
      }
    } catch (error) {
      console.error('[GenerationQueue] Failed to get queue stats:', error)
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Obtener jobs fallidos recientes para debugging
   */
  async getRecentFailedJobs(limit: number = 10) {
    try {
      const failedJobs = await this.queue.getFailed(0, limit)

      return failedJobs.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        failedAt: job.finishedOn ? new Date(job.finishedOn) : new Date()
      }))
    } catch (error) {
      console.error('[GenerationQueue] Failed to get recent failed jobs:', error)
      return []
    }
  }

  /**
   * Limpiar jobs completados antiguos
   */
  async cleanOldJobs(maxAge: number = 24 * 60 * 60 * 1000) { // 24 horas por defecto
    try {
      const cutoff = Date.now() - maxAge

      await this.queue.clean(cutoff, 100, 'completed')
      await this.queue.clean(cutoff, 1000, 'failed')

      console.log(`[GenerationQueue] Cleaned old jobs older than ${maxAge}ms`)
    } catch (error) {
      console.error('[GenerationQueue] Failed to clean old jobs:', error)
    }
  }

  /**
   * Cerrar la cola (para shutdown graceful)
   */
  async close() {
    try {
      await this.queue.close()
      console.log('[GenerationQueue] Closed successfully')
    } catch (error) {
      console.error('[GenerationQueue] Error closing queue:', error)
    }
  }

  /**
   * Obtener instancia de la cola (para Bull Board)
   */
  getQueueInstance(): Queue {
    return this.queue
  }
}

// Instancia singleton
export const generationQueue = new GenerationQueue()