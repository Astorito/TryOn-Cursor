import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";
import { checkRateLimitByTier, getTierLimits } from "@/lib/rate-limit";
import { logger } from "@/lib/logger"
import { createRequestLogger } from "@/lib/logger";

// ── Importar cache ──
import { generateInputsHash, getCachedResult, setCachedResult } from "@/lib/cache";

// ── Importar CORS ──
import { isOriginAllowed } from "@/lib/cors";

export const runtime = "nodejs";
export const maxDuration = 10; // Reducido ya que ahora es asíncrono

function corsJson(data: any, status = 200, requestId?: string) {
  const response = NextResponse.json({ ...data, requestId }, { status })
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

/**
 * POST /api/images/generate
 *
 * Versión 2: Con multi-provider, cache y CDN propio
 */
export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || Math.random().toString(36).substring(2, 15)
  const requestLogger = createRequestLogger(requestId)
  const startTime = Date.now()

  // Helper function to add requestId to responses
  const corsJsonWithId = (data: any, status = 200) => corsJson(data, status, requestId)

  requestLogger.info('Processing generation request', {
    hasApiKey: !!request.headers.get('x-api-key'),
    garmentsCount: 0 // Will be updated after parsing
  })

  try {
    const body = await request.json()
    const { apiKey, userImage, garments } = body

    // ── Validación básica ──
    if (!apiKey || !userImage || !garments?.length) {
      requestLogger.warn('Validation failed: missing required fields', {
        hasApiKey: !!apiKey,
        hasUserImage: !!userImage,
        garmentsLength: garments?.length || 0
      })
      return corsJsonWithId({
        success: false,
        error: "API key, userImage y garments requeridos"
      }, 400)
    }

    // ── Autenticación ──
    const authResult = await validateApiKey(apiKey)
    if (!authResult.valid || !authResult.client) {
      requestLogger.warn('Authentication failed', {
        apiKey: apiKey.substring(0, 10) + '...',
        error: authResult.error
      })
      return corsJsonWithId({
        success: false,
        error: authResult.error || "API key inválida"
      }, 401)
    }

    const client = authResult.client
    requestLogger.info('Client authenticated', {
      clientId: client.id,
      tier: client.tier,
      garmentsCount: garments.length
    })

    // ── Verificar CORS dinámico ──
    const origin = request.headers.get('origin')
    const originAllowed = await isOriginAllowed(client.id, origin)

    if (!originAllowed) {
      requestLogger.warn('CORS validation failed for client', {
        clientId: client.id,
        origin,
        allowedDomains: client.allowedDomains?.map(d => d.domain) || []
      })
      return corsJsonWithId({
        success: false,
        error: 'Origin no autorizado para este cliente'
      }, 403)
    }

    // ── Rate limiting por tier ──
    const rateLimitResult = await checkRateLimitByTier(client.id, client.tier)

    if (!rateLimitResult.allowed) {
      const tierLimits = getTierLimits(client.tier)
      return corsJsonWithId({
        success: false,
        error: `Límite de rate alcanzado. Reintentá en ${Math.ceil(rateLimitResult.resetInMs / 1000)} segundos`,
        tier: client.tier,
        limits: tierLimits,
        remainingMs: rateLimitResult.resetInMs
      }, 429)
    }

    // ── Verificar límite de uso ──
    const generationCount = await prisma.generation.count({
      where: { clientId: client.id }
    })

    if (client.limit > 0 && generationCount >= client.limit) {
      return corsJson({
        success: false,
        error: "Límite de generaciones alcanzado"
      }, 403)
    }

    // ── CACHE: Verificar si ya tenemos este resultado ──
    const inputsHash = generateInputsHash(userImage, garments)

    if (process.env.ENABLE_RESULT_CACHE === 'true') {
      const cachedUrl = await getCachedResult(inputsHash, client.id)

      if (cachedUrl) {
        console.log(`[${requestId}] Cache HIT - returning cached result`)

        // Registrar métrica de cache hit (no bloquear la respuesta si falla)
        try {
          await prisma.metric.create({
            data: {
              type: 'GENERATION',
              clientId: client.id,
              status: 'success',
              durationMs: Date.now() - startTime,
              model: 'cached'
            }
          })
        } catch (metricErr) {
          // Loggear el fallo pero no propagarlo al cliente
          console.error(`[${requestId}] Failed to create metric (non-blocking):`, metricErr)
        }

        return corsJsonWithId({
          success: true,
          data: {
            resultUrl: cachedUrl,
            cached: true,
            timing: {
              totalMs: Date.now() - startTime,
              aiMs: 0
            }
          }
        })
      }
    }

    console.log(`[${requestId}] Cache MISS - queuing generation job`)

    // ── CREAR JOB ID ÚNICO ──
    const jobId = `gen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // ── CREAR REGISTRO EN BASE DE DATOS (no bloquear si falla: loguear y continuar)
    try {
      await prisma.generation.create({
        data: {
          id: jobId,
          clientId: client.id,
          status: 'QUEUED',
          model: 'queued',
          personImageUrl: userImage.substring(0, 200),
          garmentUrls: garments.map((g: string) => g.substring(0, 200)),
          startedAt: new Date()
        }
      })
    } catch (createErr) {
      // Loguear el fallo pero no bloquear la generación. Esto evita 500 por errores en DB (enums, etc.)
      console.error(`[${requestId}] Failed to create generation record (non-blocking):`, createErr)
    }

    // ── VERIFICAR SI TENEMOS REDIS CONFIGURADO ──
    const hasRedis = process.env.REDIS_URL &&
                     process.env.REDIS_URL !== 'redis://localhost:6379' &&
                     process.env.REDIS_URL.includes('rediss://')

    if (hasRedis) {
      // ── MODO COLA: Usar BullMQ ──
      requestLogger.info('Using queue mode (Redis available)')

      const { generationQueue } = await import('@/lib/queue/generation-queue')
      const { getPriorityForTier } = await import('@/lib/queue/types')

      // Preparar datos del job
      const jobData = {
        jobId,
        clientId: client.id,
        personImageUrl: userImage,
        garmentUrls: garments,
        apiKey,
        requestedAt: new Date(),
        priority: getPriorityForTier(client.tier)
      }

      // Agregar job a la cola
      await generationQueue.addGenerationJob(jobData)

      requestLogger.info('Job queued successfully', {
        jobId,
        clientId: client.id,
        garmentsCount: garments.length,
        priority: jobData.priority
      })

      return corsJsonWithId({
        success: true,
        jobId,
        status: 'queued',
        estimatedTime: 10,
        message: 'Tu imagen está siendo generada. Usa el jobId para consultar el progreso.'
      })
    } else {
      // ── MODO SÍNCRONO: Procesar directamente (para desarrollo) ──
      requestLogger.info('Using sync mode (no Redis configured)')

      try {
        // ── IMPORTAR SISTEMA AI ──
        const { aiRouter } = await import('@/lib/ai')

        // ── GENERACIÓN DIRECTA ──
        const aiStartTime = Date.now()
        const result = await aiRouter.generate({
          personImageUrl: userImage,
          garmentImageUrl: garments[0], // Por ahora primera prenda
          seed: Math.floor(Math.random() * 1000000)
        })
        const aiDuration = Date.now() - aiStartTime

        let finalResultUrl = result.imageUrl

        // ── PERSISTIR EN R2 (opcional) ──
        if (process.env.R2_ACCOUNT_ID) {
          try {
            const { R2Storage } = await import('@/lib/storage/r2-storage')
            const r2Storage = new R2Storage()
            finalResultUrl = await r2Storage.persistImage(
              result.imageUrl,
              jobId,
              client.id
            )
            requestLogger.info('Image persisted to R2', { finalResultUrl })
          } catch (r2Error) {
            requestLogger.warn('R2 persistence failed, using original URL', {
              error: (r2Error as Error).message
            })
          }
        }

        // ── ACTUALIZAR BASE DE DATOS (no bloquear la respuesta si falla)
        try {
          await prisma.generation.update({
            where: { id: jobId },
            data: {
              status: 'COMPLETED',
              resultUrl: finalResultUrl,
              model: `${result.provider}/${result.modelUsed}`,
              durationMs: Date.now() - startTime,
              falDurationMs: aiDuration,
              completedAt: new Date()
            }
          })
        } catch (updateErr) {
          console.error(`[${requestId}] Failed to update generation record (non-blocking):`, updateErr)
        }

        // ── GUARDAR EN CACHE ──
        if (process.env.ENABLE_RESULT_CACHE === 'true') {
          const ttl = parseInt(process.env.CACHE_TTL_HOURS || '24')
          await setCachedResult(generateInputsHash(userImage, garments), finalResultUrl, client.id, result.provider, ttl)
        }

        requestLogger.info('Generation completed synchronously', {
          jobId,
          provider: result.provider,
          duration: aiDuration
        })

        return corsJsonWithId({
          success: true,
          data: {
            resultUrl: finalResultUrl,
            generationId: jobId,
            provider: result.provider,
            cached: false,
            timing: {
              totalMs: Date.now() - startTime,
              aiMs: aiDuration
            }
          }
        })

      } catch (aiError) {
        requestLogger.error('AI generation failed in sync mode', aiError as Error, { jobId })

        const aiErrorMessage = (aiError as any)?.message || 'Unknown AI error'

        // Actualizar base de datos con error (no bloquear si falla)
        try {
          await prisma.generation.update({
            where: { id: jobId },
            data: {
              status: 'ERROR',
              error: aiErrorMessage,
              durationMs: Date.now() - startTime,
              completedAt: new Date()
            }
          })
        } catch (updateErr) {
          console.error(`[${requestId}] Failed to update generation record on error (non-blocking):`, updateErr)
        }

        // En modo desarrollo, devolver el detalle del error para facilitar debugging
        return corsJsonWithId({
          success: false,
          error: 'Error al generar la imagen. ' + aiErrorMessage
        }, 500)
      }
    }

  } catch (error) {
    requestLogger.error('Unexpected error in generation endpoint', error as Error, {
      processingTime: Date.now() - startTime
    })
    return corsJsonWithId({
      success: false,
      error: 'Error interno del servidor'
    }, 500)
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}