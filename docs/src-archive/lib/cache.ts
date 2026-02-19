import crypto from 'crypto'

/**
 * Sistema de cache para resultados de generación
 *
 * - Usa hash de inputs como key
 * - TTL configurable (default 24h)
 * - Por ahora usa in-memory storage, preparado para BD
 */

export interface CacheEntry {
  inputsHash: string
  resultUrl: string
  clientId: string
  provider: string
  createdAt: Date
  expiresAt: Date
}

// In-memory cache (reemplazar con Redis/BD en producción)
const memoryCache = new Map<string, CacheEntry>()

/**
 * Genera un hash único de los inputs
 */
export function generateInputsHash(
  personImageUrl: string,
  garmentUrls: string[]
): string {
  // Crear string concatenando todas las URLs ordenadas
  const inputString = [personImageUrl, ...garmentUrls.sort()].join('|')

  // Hash SHA-256
  return crypto
    .createHash('sha256')
    .update(inputString)
    .digest('hex')
    .substring(0, 32) // Primeros 32 caracteres
}

/**
 * Busca un resultado en cache
 * @returns URL del resultado si existe y no expiró, null si no
 */
export async function getCachedResult(
  inputsHash: string,
  clientId: string
): Promise<string | null> {
  try {
    const cached = memoryCache.get(inputsHash)

    if (!cached) {
      return null
    }

    // Verificar si expiró
    if (cached.expiresAt < new Date()) {
      // Eliminar entrada expirada
      memoryCache.delete(inputsHash)
      return null
    }

    // Verificar que sea del mismo cliente
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

/**
 * Guarda un resultado en cache
 */
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
    // No lanzar error - el cache es opcional
  }
}

/**
 * Limpia entradas expiradas (llamar con un cron)
 */
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

/**
 * Obtiene estadísticas del cache (para debugging)
 */
export function getCacheStats(): {
  totalEntries: number
  estimatedSize: number
} {
  return {
    totalEntries: memoryCache.size,
    estimatedSize: memoryCache.size * 200 // Estimación aproximada en bytes
  }
}