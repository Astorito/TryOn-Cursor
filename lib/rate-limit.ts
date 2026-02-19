import { prisma } from "@/lib/db";

/**
 * Rate limiting usando el modelo RateLimit de Prisma (Supabase/PostgreSQL).
 *
 * Ventana deslizante: si el count supera el límite dentro de la ventana,
 * la request se rechaza. La ventana se reinicia al expirar.
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Verifica y consume un "token" de rate limit.
 *
 * @param key - Identificador único (ej: `api:${clientId}`, `ip:${ip}`)
 * @param limit - Máximo de requests por ventana
 * @param windowMs - Duración de la ventana en ms (default: 60s)
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs = 60_000
): Promise<RateLimitResult> {
  const now = new Date();

  try {
    // Buscar o crear el registro
    const existing = await prisma.rateLimit.findUnique({ where: { key } });

    if (!existing || existing.expiresAt < now) {
      // Ventana expirada o no existe → crear nueva ventana
      const expiresAt = new Date(now.getTime() + windowMs);

      await prisma.rateLimit.upsert({
        where: { key },
        update: { count: 1, windowStart: now, expiresAt },
        create: { key, count: 1, windowStart: now, expiresAt },
      });

      return { allowed: true, remaining: limit - 1, resetAt: expiresAt };
    }

    // Ventana activa
    if (existing.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: existing.expiresAt,
      };
    }

    // Incrementar contador
    await prisma.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });

    return {
      allowed: true,
      remaining: limit - existing.count - 1,
      resetAt: existing.expiresAt,
    };
  } catch (error) {
    console.error("[rate-limit] Error:", error);
    // En caso de error de DB, permitir (fail open)
    return { allowed: true, remaining: limit, resetAt: new Date(now.getTime() + windowMs) };
  }
}

/**
 * Limpia registros de rate limit expirados.
 * Llamar periódicamente (ej: desde un cron o health check).
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  const result = await prisma.rateLimit.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

// --- Tier-based helpers (compatibilidad con ruta docs) ---

interface TierLimits {
  requestsPerMinute: number
  requestsPerDay: number
}

const TIER_LIMITS: Record<string, TierLimits> = {
  free: { requestsPerMinute: 5, requestsPerDay: 100 },
  starter: { requestsPerMinute: 20, requestsPerDay: 1000 },
  pro: { requestsPerMinute: 60, requestsPerDay: 5000 },
  enterprise: { requestsPerMinute: 200, requestsPerDay: 50000 }
}

// In-memory store for tier-based limiting (simple fallback)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function cleanupExpiredEntries() {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}

export async function checkRateLimitByTier(
  clientId: string,
  tier: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date; resetInMs: number }> {
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free

  const minuteResult = await checkRateLimit(
    `minute:${clientId}`,
    limits.requestsPerMinute,
    60_000
  )

  if (!minuteResult.allowed) {
    return {
      ...minuteResult,
      resetInMs: minuteResult.resetAt.getTime() - Date.now()
    }
  }

  const dayResult = await checkRateLimit(
    `day:${clientId}`,
    limits.requestsPerDay,
    86400_000
  )

  return {
    ...dayResult,
    resetInMs: dayResult.resetAt.getTime() - Date.now()
  }
}

export function getTierLimits(tier: string): TierLimits {
  return TIER_LIMITS[tier] || TIER_LIMITS.free
}

export function getAllTiers(): Record<string, TierLimits> {
  return { ...TIER_LIMITS }
}
