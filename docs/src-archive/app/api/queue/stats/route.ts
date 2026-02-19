import { NextRequest, NextResponse } from 'next/server'
import { generationQueue } from '../../../../lib/queue/generation-queue'
import { generationWorker } from '../../../../lib/queue/generation-worker'
import { verifyToken } from '../../../../lib/jwt'

/**
 * GET /api/queue/stats
 *
 * Retorna estadísticas detalladas de la cola y workers
 * Requiere autenticación de admin
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación de admin
    const token = request.cookies.get('admin_token')?.value
    if (!token || !verifyToken(token)) {
      return NextResponse.json({
        success: false,
        error: 'Acceso no autorizado'
      }, { status: 401 })
    }

    // Obtener estadísticas de la cola
    const queueStats = await generationQueue.getQueueStats()

    // Obtener estadísticas del worker
    const workerStats = await generationWorker.getStats()

    // Obtener jobs fallidos recientes
    const recentFailed = await generationQueue.getRecentFailedJobs(5)

    // Calcular métricas adicionales
    const totalJobs = queueStats.total
    const throughput = calculateThroughput(queueStats)
    const avgProcessingTime = await calculateAvgProcessingTime()

    const stats = {
      // Estadísticas de cola
      queue: {
        waiting: queueStats.waiting,
        active: queueStats.active,
        completed: queueStats.completed,
        failed: queueStats.failed,
        delayed: queueStats.delayed,
        total: totalJobs
      },

      // Estadísticas de workers
      workers: workerStats,

      // Rendimiento
      performance: {
        throughputJobsPerMinute: throughput,
        avgProcessingTimeMs: avgProcessingTime,
        errorRate: totalJobs > 0 ? (queueStats.failed / totalJobs) * 100 : 0
      },

      // Jobs fallidos recientes
      recentFailed: recentFailed.map((job: any) => ({
        id: job.id,
        name: job.name,
        failedReason: job.failedReason,
        failedAt: job.failedAt,
        attemptsMade: job.attemptsMade
      })),

      // Timestamp
      timestamp: new Date().toISOString(),

      // Configuración
      config: {
        workerConcurrency: parseInt(process.env.QUEUE_WORKER_CONCURRENCY || '5'),
        maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '3'),
        cacheEnabled: process.env.ENABLE_RESULT_CACHE === 'true',
        r2Enabled: !!process.env.R2_ACCOUNT_ID
      }
    }

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('[QueueStats] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error obteniendo estadísticas de cola',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * Calcular throughput aproximado (jobs por minuto)
 * Basado en jobs completados en las últimas horas
 */
async function calculateThroughput(queueStats: any): Promise<number> {
  try {
    // Estimación simple: asumir que los jobs completados son del último período
    // En producción, usaríamos métricas históricas
    const completedCount = queueStats.completed || 0

    if (completedCount === 0) return 0

    // Asumir que representan los últimos 60 minutos (esto es aproximado)
    return Math.round((completedCount / 60) * 100) / 100 // redondear a 2 decimales
  } catch {
    return 0
  }
}

/**
 * Calcular tiempo promedio de procesamiento
 * En producción, esto vendría de métricas históricas
 */
async function calculateAvgProcessingTime(): Promise<number> {
  try {
    // Estimación: tiempo promedio de procesamiento AI
    // En producción, calcular desde métricas reales
    return 12000 // 12 segundos promedio
  } catch {
    return 0
  }
}