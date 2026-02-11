import { ConnectionOptions } from 'bullmq'

/**
 * Configuración de conexión a Redis para BullMQ
 * Compatible con Redis local, Upstash, o cualquier provider Redis
 */

// Parsear URL de Redis para extraer componentes
function parseRedisUrl(redisUrl: string) {
  try {
    const url = new URL(redisUrl)

    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.searchParams.get('password') || url.password || undefined,
      tls: url.protocol === 'rediss:' ? {} : undefined, // Upstash usa rediss:
      username: url.username || undefined
    }
  } catch (error) {
    console.warn('[Queue] Invalid Redis URL, using defaults:', redisUrl)
    return {
      host: 'localhost',
      port: 6379
    }
  }
}

// Configuración de conexión reutilizable
export const redisConnection: ConnectionOptions = {
  ...parseRedisUrl(process.env.REDIS_URL || 'redis://localhost:6379'),
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true, // Conectar solo cuando sea necesario
  keepAlive: 30000, // 30 segundos
  family: 4, // IPv4
}

// Configuración adicional para workers
export const workerConnection: ConnectionOptions = {
  ...redisConnection,
  maxRetriesPerRequest: 5, // Workers necesitan más retries
  retryDelayOnFailover: 500,
}

// Configuración adicional para la cola
export const queueConnection: ConnectionOptions = {
  ...redisConnection,
  enableReadyCheck: true,
  readyCheck: true,
}

// Función para verificar conexión
export async function testRedisConnection(): Promise<boolean> {
  try {
    const { Redis } = await import('ioredis')

    const redis = new Redis(redisConnection)

    await redis.ping()
    await redis.quit()

    console.log('[Queue] Redis connection test successful')
    return true
  } catch (error) {
    console.error('[Queue] Redis connection test failed:', error)
    return false
  }
}