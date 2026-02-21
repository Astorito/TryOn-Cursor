import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { FalClient } from "@/lib/fal-client";
import { corsJson } from "@/lib/cors";

// FAL Client ya tiene la config top-level, no necesita apiKey en constructor
const falClient = new FalClient();

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * POST /api/images/generate
 *
 * Genera una imagen de virtual try-on usando FAL AI.
 *
 * Body:
 * - apiKey: string (API key del cliente)
 * - userImage: string (base64 data URL de la imagen del usuario)
 * - garments: string[] (array de base64 data URLs de prendas)
 * - model?: string (opcional, modelo a usar)
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(2, 15);
  const startTime = Date.now();

  // #region agent log
  const _log = (message: string, data: Record<string, unknown>) => {
    fetch('http://127.0.0.1:7242/ingest/6409409d-10bf-4ec6-ac7c-944201295ebb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'api/images/generate/route.ts', message, data: { requestId, ...data }, timestamp: Date.now(), hypothesisId: 'H1,H2,H3,H4,H5' }) }).catch(() => {});
  };
  // #endregion

  try {
    console.log(`[${requestId}] Processing generation request`);

    // Parse request body
    const body = await request.json();
    const {
      apiKey,
      userImage,
      garments,
      personImageUrl,
      garmentImageUrl,
    } = body;

    const modelUsed = 'fal-ai/flux-pro/kontext/multi';

    // #region agent log
    _log('POST body parsed', { hasApiKey: !!apiKey, userImageLen: typeof userImage === 'string' ? userImage.length : 0, garmentsCount: Array.isArray(garments) ? garments.length : 0, hasFalKey: !!process.env.FAL_KEY });
    // #endregion

    // ── Validate input ──
    if (!apiKey || typeof apiKey !== "string") {
      return corsJson({ success: false, error: "API key requerida" }, 400);
    }
    if (!userImage || typeof userImage !== "string") {
      return corsJson(
        { success: false, error: "Imagen de usuario requerida" },
        400
      );
    }
    if (!garments || !Array.isArray(garments) || garments.length === 0) {
      return corsJson(
        { success: false, error: "Al menos una prenda requerida" },
        400
      );
    }
    if (garments.length > 3) {
      return corsJson(
        { success: false, error: "Máximo 3 prendas permitidas" },
        400
      );
    }

    // ── Authenticate, Rate limit y Check usage en paralelo (queries independientes) ──
    const [authResult, rateLimitResult, generationCount] = await Promise.all([
      validateApiKey(apiKey),
      checkRateLimit(`client_temp`, 10, 60_000),
      Promise.resolve(0)
    ]);

    if (!authResult.valid || !authResult.client) {
      return corsJson(
        { success: false, error: authResult.error || "API key inválida" },
        401
      );
    }

    const client = authResult.client;

    // ── Now check rate limit with actual client ID ──
    const actualRateLimit = await checkRateLimit(
      `client_${client.id}`,
      10,
      60_000
    );
    if (!actualRateLimit.allowed) {
      const waitSec = Math.ceil(
        (actualRateLimit.resetAt.getTime() - Date.now()) / 1000
      );
      return corsJson(
        {
          success: false,
          error: `Límite de rate alcanzado. Reintentá en ${waitSec}s`,
        },
        429
      );
    }

    // ── Check usage limit (now that we have client) ──
    const actualGenerationCount = await prisma.generation.count({
      where: { clientId: client.id },
    });

    if (client.limit > 0 && actualGenerationCount >= client.limit) {
      return corsJson(
        { success: false, error: "Límite de generaciones alcanzado" },
        403
      );
    }

    console.log(`[${requestId}] Starting generation for client ${client.name}`);

    // #region agent log
    _log('before prisma.generation.create', { clientId: client.id });
    // #endregion

    // ── Create generation record ──
    const generation = await prisma.generation.create({
      data: {
        clientId: client.id,
        status: "PROCESSING",
        model: modelUsed,
        personImageUrl: (personImageUrl || userImage || '').substring(0, 200),
        garmentUrls: (garments && garments.length ? garments.map((g: string) => g.substring(0, 200)) : [(garmentImageUrl || '').substring(0, 200)]),
        startedAt: new Date(),
      },
    });

    try {
      // #region agent log
      _log('before falClient.generate', { generationId: generation.id });
      // #endregion

      const personImg = personImageUrl || userImage;
      const garmentImg = garmentImageUrl || (garments && garments[0]);

      // Explicit validation with clear error messages
      if (!personImg) {
        throw new Error('No person image provided (personImageUrl or userImage required)');
      }
      if (!garmentImg) {
        throw new Error('No garment image provided (garmentImageUrl or garments[0] required)');
      }

      console.log(`[${requestId}] Preparing FAL payload:`);
      console.log(`[${requestId}]   personImg: ${typeof personImg === 'string' ? (personImg.startsWith('data:') ? 'base64' : 'url') : typeof personImg} - len:${typeof personImg === 'string' ? personImg.length : 0}`);
      console.log(`[${requestId}]   garmentImg: ${typeof garmentImg === 'string' ? (garmentImg.startsWith('data:') ? 'base64' : 'url') : typeof garmentImg} - len:${typeof garmentImg === 'string' ? garmentImg.length : 0}`);
      const falStartTime = Date.now();
      let falResult;
      try {
        falResult = await falClient.generate({
          personImageUrl: personImg,
          garmentImageUrl: garmentImg,
          seed: Math.floor(Math.random() * 1000000),
        });
      } catch (err) {
        console.error(`[${requestId}] falClient.generate threw error:`, err);
        const e = err as any;
        try {
          console.error(`[${requestId}] fal error status:`, e?.status);
          if (e?.body) {
            console.error(`[${requestId}] fal error body:`, typeof e.body === 'object' ? JSON.stringify(e.body, null, 2) : e.body);
          }
        } catch (logErr) {
          console.error(`[${requestId}] Error logging fal error details:`, logErr);
        }
        throw err;
      }
      const falDuration = Date.now() - falStartTime;

      // ── Update generation with success + Record metric en paralelo ──
      await Promise.all([
        prisma.generation.update({
          where: { id: generation.id },
          data: {
            status: "COMPLETED",
            resultUrl: falResult.imageUrl,
            durationMs: Date.now() - startTime,
            falDurationMs: falDuration,
            completedAt: new Date(),
          },
        }),
        prisma.metric.create({
          data: {
            type: "GENERATION",
            clientId: client.id,
            model: modelUsed,
            durationMs: Date.now() - startTime,
            status: "success",
          },
        })
      ]);

      console.log(
        `[${requestId}] Generation completed in ${Date.now() - startTime}ms`
      );

      return corsJson({
        success: true,
        data: {
          resultUrl: falResult.imageUrl,
          generationId: generation.id,
          timing: {
            totalMs: Date.now() - startTime,
            falMs: falDuration,
          },
        },
      });
    } catch (falError) {
      console.error(`[${requestId}] FAL AI error:`, falError);
      // #region agent log
      const _e = falError as Error;
      _log('falError catch', { errorMessage: _e?.message, name: _e?.name });
      // #endregion
      
      const isUnauthorized = falError instanceof Error && /unauthorized|invalid.*key|authentication/i.test(falError.message);
      const userError = isUnauthorized
        ? "FAL_KEY inválida o sin permisos. Verificá tu API key en fal.ai/dashboard/keys"
        : "Error al generar la imagen";
      
      const debugDetails = process.env.DEBUG_FAL === '1' ? (() => {
        try {
          const e = falError as any;
          return {
            message: e?.message,
            name: e?.name,
            status: e?.status,
            body: typeof e?.body === 'object' ? JSON.stringify(e.body) : e?.body,
          };
        } catch (err) {
          return { debugError: String(err) };
        }
      })() : undefined;

      await Promise.all([
        prisma.generation.update({
          where: { id: generation.id },
          data: {
            status: "ERROR",
            error: falError instanceof Error ? falError.message : "FAL AI error",
            durationMs: Date.now() - startTime,
            completedAt: new Date(),
          },
        }),
        prisma.metric.create({
          data: {
            type: "GENERATION",
            clientId: client.id,
            model: modelUsed,
            durationMs: Date.now() - startTime,
            status: "error",
            error: falError instanceof Error ? falError.message : "FAL AI error",
          },
        })
      ]);

      const responsePayload: any = { success: false, error: userError };
      if (debugDetails) responsePayload.debug = debugDetails;

      return corsJson(responsePayload, 500);
    }
  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error);
    // #region agent log
    const _e = error as Error;
    fetch('http://127.0.0.1:7242/ingest/6409409d-10bf-4ec6-ac7c-944201295ebb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'api/images/generate/route.ts', message: 'outer catch', data: { requestId, errorMessage: _e?.message, name: _e?.name }, timestamp: Date.now(), hypothesisId: 'H4,H5' }) }).catch(() => {});
    // #endregion
    return corsJson(
      { success: false, error: "Error interno del servidor" },
      500
    );
  }
}

// ── CORS preflight ──
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}