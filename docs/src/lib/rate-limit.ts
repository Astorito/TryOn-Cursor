import { logger } from './logger'

// Rate limiting implementation using in-memory storage
// TODO: Replace with Redis or Upstash for production

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  resetInMs: number
}

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

// In-memory storage (replace with Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function cleanupExpiredEntries() {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now()
  const resetAt = now + windowMs

  // Cleanup expired entries occasionally
  if (Math.random() < 0.01) { // 1% chance
    cleanupExpiredEntries()
  }

  const existing = rateLimitStore.get(key)

  if (!existing || existing.resetAt < now) {
    // First request or expired window
    rateLimitStore.set(key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: new Date(resetAt),
      resetInMs: windowMs
    }
  }

  if (existing.count >= limit) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(existing.resetAt),
      resetInMs: existing.resetAt - now
    }
  }

  // Increment counter
  existing.count++
  rateLimitStore.set(key, existing)

  return {
    allowed: true,
    remaining: limit - existing.count,
    resetAt: new Date(existing.resetAt),
    resetInMs: existing.resetAt - now
  }
}

export async function checkRateLimitByTier(
  clientId: string,
  tier: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date; resetInMs: number }> {
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free

  // Rate limit por minuto
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

  // Rate limit por día
  const dayResult = await checkRateLimit(
    `day:${clientId}`,
    limits.requestsPerDay,
    86400_000 // 24 horas
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