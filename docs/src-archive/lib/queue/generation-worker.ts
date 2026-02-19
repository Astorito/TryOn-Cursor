import { Worker, Job } from 'bullmq'
import type { GenerationJobData, GenerationJobResult, JobMetrics } from './types'
import { workerConnection } from './connection'
import { prisma } from '@/lib/db'

// Importar sistema AI
import { aiRouter } from '@/lib/ai'

// Importar cache y storage
import { generateInputsHash, setCachedResult } from '@/lib/cache'
import { R2Storage } from '@/lib/storage/r2-storage'

// Importar validación
import { validateApiKey } from '@/lib/auth'

/**
 * Worker BullMQ para procesar jobs de generación de TryOn
 *
 * Procesa jobs en background con concurrencia configurable
 */

export class GenerationWorker {
  private worker: Worker<GenerationJobData>
  private r2Storage?: R2Storage

  constructor() {
    // Inicializar R2 si está configurado
    if (process.env.R2_ACCOUNT_ID) {
      this.r2Storage = new R2Storage()
    }

    // Configurar concurrencia desde env
    const concurrency = parseInt(process.env.QUEUE_WORKER_CONCURRENCY || '5')

    this.worker = new Worker<GenerationJobData>(
      'tryon-generation',
      this.processJob.bind(this),
      {
        connection: workerConnection,
        concurrency,
        limiter: {
          max: concurrency,
          duration: 1000 // Máximo por segundo
        }
      }
    )

    // Event listeners para logging
    this.setupEventListeners()

    console.log(`[GenerationWorker] Started with concurrency: ${concurrency}`)
  }

  /**
   * Procesar un job de generación
   */
  private async processJob(job: Job<GenerationJobData>): Promise<GenerationJobResult> {
    const { jobId, clientId, personImageUrl, garmentUrls, apiKey, requestedAt, priority } = job.data

    console.log(`[Worker] Processing job ${jobId} (attempt ${job.attemptsMade + 1})`)

    const startTime = Date.now()
    let queueTimeMs = startTime - requestedAt.getTime()

    try {
      // 1. Validar que el cliente aún existe
      const authResult = await validateApiKey(apiKey)
      if (!authResult.valid || !authResult.client) {
        throw new Error(`Invalid API key for client ${clientId}`)
      }

      const client = authResult.client

      // 2. Verificar límite de uso (por si cambió desde que se creó el job)
      const generationCount = await prisma.generation.count({
        where: { clientId: client.id }
      })

      if (client.limit > 0 && generationCount >= client.limit) {
        throw new Error('Client has reached generation limit')
      }

      // 3. Actualizar progreso del job
      await job.updateProgress(10)

      // 4. Generar imagen usando AI Router
      console.log(`[Worker] Calling AI Router for job ${jobId}`)
      await job.updateProgress(25)

      const aiResult = await aiRouter.generate({
        personImageUrl,
        garmentImageUrl: garmentUrls[0], // Por ahora primera prenda
        seed: Math.floor(Math.random() * 1000000)
      })

      await job.updateProgress(75)
      const aiDuration = Date.now() - startTime

      let finalResultUrl = aiResult.imageUrl

      // 5. Persistir en R2 (opcional)
      let persistedToR2 = false
      if (this.r2Storage) {
        try {
          finalResultUrl = await this.r2Storage.persistImage(
            aiResult.imageUrl,
            jobId,
            clientId
          )
          persistedToR2 = true
          console.log(`[Worker] Image persisted to R2: ${finalResultUrl}`)
        } catch (r2Error) {
          console.error(`[Worker] R2 persistence failed for job ${jobId}:`, r2Error)
          // Continuar con URL original
        }
      }

      await job.updateProgress(90)

      // 6. Actualizar base de datos
      await prisma.generation.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          resultUrl: finalResultUrl,
          model: `${aiResult.provider}/${aiResult.modelUsed}`,
          durationMs: Date.now() - startTime,
          falDurationMs: aiDuration,
          completedAt: new Date()
        }
      })

      // 7. Guardar en cache para futuras requests
      if (process.env.ENABLE_RESULT_CACHE === 'true') {
        const inputsHash = generateInputsHash(personImageUrl, garmentUrls)
        const ttl = parseInt(process.env.CACHE_TTL_HOURS || '24')

        await setCachedResult(inputsHash, finalResultUrl, clientId, aiResult.provider, ttl)
      }

      // 8. Registrar métricas
      const metrics: JobMetrics = {
        jobId,
        clientId,
        queueTimeMs,
        processingTimeMs: aiDuration,
        totalTimeMs: Date.now() - startTime,
        attempt: job.attemptsMade + 1,
        provider: aiResult.provider,
        model: aiResult.modelUsed,
        status: 'success',
        createdAt: new Date()
      }

      await this.saveMetrics(metrics)

      await job.updateProgress(100)

      console.log(`[Worker] Job ${jobId} completed in ${Date.now() - startTime}ms with ${aiResult.provider}`)

      return {
        resultUrl: finalResultUrl,
        provider: aiResult.provider,
        modelUsed: aiResult.modelUsed,
        durationMs: aiDuration,
        cached: false,
        persistedToR2
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[Worker] Job ${jobId} failed:`, errorMessage)

      // Actualizar base de datos con error
      try {
        await prisma.generation.update({
          where: { id: jobId },
          data: {
            status: 'ERROR',
            error: errorMessage,
            durationMs: Date.now() - startTime,
            completedAt: new Date()
          }
        })

        // Registrar métricas de error
        const errorMetrics: JobMetrics = {
          jobId,
          clientId,
          queueTimeMs,
          processingTimeMs: Date.now() - startTime,
          totalTimeMs: Date.now() - startTime,
          attempt: job.attemptsMade + 1,
          provider: 'unknown',
          model: 'unknown',
          status: 'failed',
          error: errorMessage,
          createdAt: new Date()
        }

        await this.saveMetrics(errorMetrics)
      } catch (dbError) {
        console.error(`[Worker] Failed to update DB for failed job ${jobId}:`, dbError)
      }

      // Lanzar error para que BullMQ maneje reintentos
      throw new Error(errorMessage)
    }
  }

  /**
   * Guardar métricas en la base de datos
   */
  private async saveMetrics(metrics: JobMetrics): Promise<void> {
    try {
      await prisma.metric.create({
        data: {
          type: 'GENERATION',
          clientId: metrics.clientId,
          model: metrics.provider,
          durationMs: metrics.processingTimeMs,
          status: metrics.status,
          error: metrics.error
          // TODO: Agregar campos específicos para métricas de cola
        }
      })
    } catch (error) {
      console.error('[Worker] Failed to save metrics:', error)
      // No fallar el job por métricas
    }
  }

  /**
   * Configurar event listeners para logging
   */
  private setupEventListeners(): void {
    this.worker.on('completed', (job) => {
      console.log(`[Worker] Job ${job?.id} completed successfully`)
    })

    this.worker.on('failed', (job, err) => {
      console.error(`[Worker] Job ${job?.id} failed:`, err.message)
    })

    this.worker.on('stalled', (jobId) => {
      console.warn(`[Worker] Job ${jobId} stalled`)
    })

    this.worker.on('error', (err) => {
      console.error('[Worker] Worker error:', err)
    })

    // Logging de rendimiento
    this.worker.on('active', (job) => {
      console.log(`[Worker] Started processing job ${job?.id}`)
    })

    this.worker.on('waiting', (jobId) => {
      console.log(`[Worker] Job ${jobId} is waiting`)
    })
  }

  /**
   * Obtener estadísticas del worker
   */
  async getStats() {
    try {
      const isRunning = this.worker.isRunning()
      const waiting = await this.worker.getWaiting()
      const active = await this.worker.getActive()

      return {
        isRunning,
        waitingCount: waiting.length,
        activeCount: active.length,
        totalJobs: waiting.length + active.length
      }
    } catch (error) {
      return {
        isRunning: false,
        waitingCount: 0,
        activeCount: 0,
        totalJobs: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Cerrar el worker (para shutdown graceful)
   */
  async close(): Promise<void> {
    try {
      await this.worker.close()
      console.log('[GenerationWorker] Closed successfully')
    } catch (error) {
      console.error('[GenerationWorker] Error closing worker:', error)
    }
  }

  /**
   * Pausar el worker
   */
  async pause(): Promise<void> {
    await this.worker.pause()
    console.log('[GenerationWorker] Paused')
  }

  /**
   * Reanudar el worker
   */
  async resume(): Promise<void> {
    await this.worker.resume()
    console.log('[GenerationWorker] Resumed')
  }
}

// Instancia singleton
export const generationWorker = new GenerationWorker()