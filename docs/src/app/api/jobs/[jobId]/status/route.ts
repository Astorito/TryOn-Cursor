import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateApiKey } from '@/lib/auth'
import { generationQueue } from '@/lib/queue/generation-queue'

function corsJson(data: any, status = 200) {
  const response = NextResponse.json(data, { status })
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

/**
 * GET /api/jobs/:jobId/status
 *
 * Consulta el estado de un job de generación
 * Permite hacer polling para ver el progreso
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const jobId = params.jobId

  if (!jobId) {
    return corsJson({ success: false, error: 'Job ID requerido' }, 400)
  }

  try {
    // Verificar que el job existe en la base de datos
    const generation = await prisma.generation.findUnique({
      where: { id: jobId },
      include: { client: true }
    })

    if (!generation) {
      return corsJson({
        success: false,
        error: 'Job no encontrado'
      }, 404)
    }

    // Validar que el cliente aún tenga acceso (opcional)
    const apiKey = request.nextUrl.searchParams.get('apiKey') ||
                   request.headers.get('x-api-key')

    if (apiKey) {
      const authResult = await validateApiKey(apiKey)
      if (!authResult.valid || authResult.client?.id !== generation.clientId) {
        return corsJson({
          success: false,
          error: 'No autorizado para ver este job'
        }, 403)
      }
    }

    // Consultar estado en BullMQ
    const queueStatus = await generationQueue.getJobStatus(jobId)

    // Preparar respuesta
    const response = {
      jobId,
      status: queueStatus?.status || generation.status.toLowerCase(),
      progress: queueStatus?.progress || (generation.status === 'COMPLETED' ? 100 : 0),
      resultUrl: generation.resultUrl || queueStatus?.resultUrl,
      error: generation.error,
      queuedAt: generation.startedAt,
      startedAt: queueStatus?.startedAt,
      completedAt: generation.completedAt || queueStatus?.completedAt,
      failedAt: queueStatus?.failedAt,
      attemptsMade: queueStatus?.attemptsMade || 0,
      attemptsRemaining: queueStatus?.attemptsRemaining || 0,
      priority: queueStatus?.priority || 10,
      clientId: generation.clientId,
      estimatedTimeRemaining: calculateEstimatedTime(queueStatus)
    }

    return corsJson({
      success: true,
      data: response
    })

  } catch (error) {
    console.error(`[JobStatus] Error getting status for job ${jobId}:`, error)
    return corsJson({
      success: false,
      error: 'Error interno del servidor'
    }, 500)
  }
}

/**
 * Calcular tiempo estimado restante basado en el estado del job
 */
function calculateEstimatedTime(queueStatus: any): number | null {
  if (!queueStatus) return null

  switch (queueStatus.status) {
    case 'queued':
      // Estimar basado en posición en cola (simplificado)
      return 30 // 30 segundos estimados

    case 'processing':
      // Si lleva más de 60 segundos procesando, estimar tiempo restante
      if (queueStatus.startedAt) {
        const elapsed = Date.now() - queueStatus.startedAt.getTime()
        const estimatedTotal = 15000 // 15 segundos total estimado
        const remaining = Math.max(0, estimatedTotal - elapsed)
        return Math.ceil(remaining / 1000)
      }
      return 10 // 10 segundos estimados

    case 'completed':
    case 'failed':
      return 0

    default:
      return null
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}