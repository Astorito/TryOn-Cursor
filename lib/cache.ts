import crypto from 'crypto'

export interface CacheEntry {
  inputsHash: string
  resultUrl: string
  clientId: string
  provider: string
  createdAt: Date
  expiresAt: Date
}

const memoryCache = new Map<string, CacheEntry>()

export function generateInputsHash(
  personImageUrl: string,
  garmentUrls: string[]
): string {
  const inputString = [personImageUrl, ...garmentUrls.sort()].join('|')

  return crypto
    .createHash('sha256')
    .update(inputString)
    .digest('hex')
    .substring(0, 32)
}

export async function getCachedResult(
  inputsHash: string,
  clientId: string
): Promise<string | null> {
  try {
    const cached = memoryCache.get(inputsHash)

    if (!cached) {
      return null
    }

    if (cached.expiresAt < new Date()) {
      memoryCache.delete(inputsHash)
      return null
    }

    if (cached.clientId !== clientId) {
      return null
    }

    console.log(`[Cache] HIT for hash ${inputsHash}`)
    return cached.resultUrl
  } catch (error) {
    console.error('[Cache] Error getting cached result:', error)
    return null
  }
}

export async function setCachedResult(
  inputsHash: string,
  resultUrl: string,
  clientId: string,
  provider: string = 'unknown',
  ttlHours: number = 24
): Promise<void> {
  try {
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + ttlHours)

    const entry: CacheEntry = {
      inputsHash,
      resultUrl,
      clientId,
      provider,
      createdAt: new Date(),
      expiresAt
    }

    memoryCache.set(inputsHash, entry)

    console.log(`[Cache] SET for hash ${inputsHash} (TTL: ${ttlHours}h)`)
  } catch (error) {
    console.error('[Cache] Error setting cached result:', error)
  }
}

export async function cleanupExpiredCache(): Promise<number> {
  try {
    let cleanedCount = 0
    const now = new Date()

    for (const [key, entry] of memoryCache.entries()) {
      if (entry.expiresAt < now) {
        memoryCache.delete(key)
        cleanedCount++
      }
    }

    console.log(`[Cache] Cleaned up ${cleanedCount} expired entries`)
    return cleanedCount
  } catch (error) {
    console.error('[Cache] Error cleaning up cache:', error)
    return 0
  }
}

export function getCacheStats(): {
  totalEntries: number
  estimatedSize: number
} {
  return {
    totalEntries: memoryCache.size,
    estimatedSize: memoryCache.size * 200
  }
}
