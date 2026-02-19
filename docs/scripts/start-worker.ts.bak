#!/usr/bin/env tsx

/**
 * Script para ejecutar el worker de generación de TryOn
 *
 * Uso:
 * npm run worker
 * # o directamente:
 * tsx scripts/start-worker.ts
 *
 * Para desarrollo:
 * tsx watch scripts/start-worker.ts
 */

// Cargar variables de entorno primero
import 'dotenv/config'

// Asegurar que Prisma desactive prepared statements antes de inicializar clientes
if (!process.env.PRISMA_DISABLE_PREPARED_STATEMENTS) {
  process.env.PRISMA_DISABLE_PREPARED_STATEMENTS = '1'
}

// Importar worker después de configurar env vars
import { generationWorker } from '../src/lib/queue/generation-worker'

// Función principal
async function main() {
  console.log('🚀 Iniciando Worker de Generación TryOn...')
  console.log('📅', new Date().toISOString())

  try {
    // Verificar conexión a Redis
    console.log('🔍 Verificando conexión a Redis...')
    const { testRedisConnection } = await import('../src/lib/queue/connection')
    const redisOk = await testRedisConnection()

    if (!redisOk) {
      console.error('❌ No se pudo conectar a Redis. Verifica tu configuración.')
      process.exit(1)
    }

    console.log('✅ Conexión a Redis exitosa')

    // Mostrar configuración
    const concurrency = parseInt(process.env.QUEUE_WORKER_CONCURRENCY || '5')
    console.log(`⚙️  Configuración:`)
    console.log(`   Concurrencia: ${concurrency}`)
    console.log(`   Max reintentos: ${process.env.QUEUE_MAX_RETRIES || '3'}`)
    console.log(`   Cache habilitado: ${process.env.ENABLE_RESULT_CACHE === 'true' ? '✅' : '❌'}`)
    console.log(`   R2 habilitado: ${process.env.R2_ACCOUNT_ID ? '✅' : '❌'}`)

    console.log('')
    console.log('🎯 Worker listo. Esperando jobs...')
    console.log('💡 Presiona Ctrl+C para detener')
    console.log('')

    // El worker ya se inicializó automáticamente al importar
    // Solo necesitamos mantener el proceso vivo

    // Configurar handlers de señales para shutdown graceful
    let shuttingDown = false

    const shutdown = async (signal: string) => {
      if (shuttingDown) return

      shuttingDown = true
      console.log(`\n🛑 Recibida señal ${signal}. Cerrando worker gracefully...`)

      try {
        await generationWorker.close()
        console.log('✅ Worker cerrado exitosamente')
        process.exit(0)
      } catch (error) {
        console.error('❌ Error cerrando worker:', error)
        process.exit(1)
      }
    }

    // Señales de shutdown
    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))

    // Mantener el proceso vivo
    setInterval(() => {
      // Log de estado cada 5 minutos
      const now = new Date()
      if (now.getMinutes() % 5 === 0 && now.getSeconds() === 0) {
        console.log(`📊 Worker vivo - ${now.toISOString()}`)
      }
    }, 1000)

    // Log inicial de estado
    setTimeout(async () => {
      const stats = await generationWorker.getStats()
      console.log(`📊 Estado inicial:`, stats)
    }, 2000)

  } catch (error) {
    console.error('❌ Error iniciando worker:', error)
    process.exit(1)
  }
}

// Ejecutar
main().catch((error) => {
  console.error('❌ Error fatal:', error)
  process.exit(1)
})