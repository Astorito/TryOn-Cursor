import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { FalClient } from "@/lib/fal-client";
import { corsJson } from "@/lib/cors";

const falClient = new FalClient(process.env.FAL_KEY || "");

export const runtime = "nodejs";
export const maxDuration = 60;

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
      model = "fal-ai/gemini-3-pro-image-preview/edit",
    } = body;

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

    // ── Authenticate ──
    const authResult = await validateApiKey(apiKey);
    if (!authResult.valid || !authResult.client) {
      return corsJson(
        { success: false, error: authResult.error || "API key inválida" },
        401
      );
    }

    const client = authResult.client;

    // ── Rate limit (10 req/min) ──
    const rateLimitResult = await checkRateLimit(
      `client_${client.id}`,
      10,
      60_000
    );
    if (!rateLimitResult.allowed) {
      const waitSec = Math.ceil(
        (rateLimitResult.resetAt.getTime() - Date.now()) / 1000
      );
      return corsJson(
        {
          success: false,
          error: `Límite de rate alcanzado. Reintentá en ${waitSec}s`,
        },
        429
      );
    }

    // ── Check usage limit ──
    const generationCount = await prisma.generation.count({
      where: { clientId: client.id },
    });

    if (client.limit > 0 && generationCount >= client.limit) {
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
        model,
        personImageUrl: (personImageUrl || userImage || '').substring(0, 200), // Store truncated ref
        garmentUrls: (garments && garments.length ? garments.map((g: string) => g.substring(0, 200)) : [(garmentImageUrl || '') .substring(0,200)]),
        startedAt: new Date(),
      },
    });

    try {
      // #region agent log
      _log('before falClient.generate', { generationId: generation.id });
      // #endregion
      // ── Prepare images (prefer explicit fields personImageUrl & garmentImageUrl) ──
      const personImg = personImageUrl || userImage;
      const garmentImg = garmentImageUrl || (garments && garments[0]);

      // Prompt defaults (ultra rápida)
      const PROMPT = "Place the garment from the second image onto the person in the first image, maintaining realistic fit, natural draping, and proper lighting. Keep the person's pose and background unchanged.";
      const NEGATIVE_PROMPT = "deformed, distorted, disfigured, poor quality, blurry, unrealistic proportions, bad anatomy, wrong clothing placement, floating clothes";

      // ── Call FAL AI ──
      const falStartTime = Date.now();
      const falResult = await falClient.generate({
        personImageUrl: personImg,
        garmentImageUrl: garmentImg,
        prompt: PROMPT,
        negative_prompt: NEGATIVE_PROMPT,
        strength: 0.65,
        guidance_scale: 7.0,
        num_inference_steps: 20,
        output_format: "jpeg",
        seed: Math.floor(Math.random() * 1000000),
      });
      const falDuration = Date.now() - falStartTime;

      // ── Update generation with success ──
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: "COMPLETED",
          resultUrl: falResult.imageUrl,
          durationMs: Date.now() - startTime,
          falDurationMs: falDuration,
          completedAt: new Date(),
        },
      });

      // ── Record metric ──
      await prisma.metric.create({
        data: {
          type: "GENERATION",
          clientId: client.id,
          model,
          durationMs: Date.now() - startTime,
          status: "success",
        },
      });

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
      // Update generation with error
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: "ERROR",
          error:
            falError instanceof Error ? falError.message : "FAL AI error",
          durationMs: Date.now() - startTime,
          completedAt: new Date(),
        },
      });

      // Record error metric
      await prisma.metric.create({
        data: {
          type: "GENERATION",
          clientId: client.id,
          model,
          durationMs: Date.now() - startTime,
          status: "error",
          error:
            falError instanceof Error ? falError.message : "FAL AI error",
        },
      });

      const isUnauthorized = falError instanceof Error && /unauthorized|invalid.*key|authentication/i.test(falError.message);
      const userError = isUnauthorized
        ? "FAL_KEY inválida o sin permisos. Verificá tu API key en fal.ai/dashboard/keys"
        : "Error al generar la imagen";
      return corsJson(
        { success: false, error: userError },
        500
      );
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