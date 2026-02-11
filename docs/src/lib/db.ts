import { PrismaClient } from '@prisma/client'

// CRITICAL: Ensure prepared statements are disabled BEFORE creating Prisma client
// This prevents PostgreSQL error 42P05 "prepared statement already exists"
// which occurs with PgBouncer or connection poolers (Supabase uses PgBouncer)
if (!process.env.PRISMA_DISABLE_PREPARED_STATEMENTS) {
  process.env.PRISMA_DISABLE_PREPARED_STATEMENTS = '1'
  console.log('[Prisma] Setting PRISMA_DISABLE_PREPARED_STATEMENTS=1 (was not set)')
} else {
  console.log('[Prisma] PRISMA_DISABLE_PREPARED_STATEMENTS already set to:', process.env.PRISMA_DISABLE_PREPARED_STATEMENTS)
}

// Singleton pattern for Prisma Client
// Prevents multiple instances in development with hot reload
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Explicitly disable prepared statements in datasource options
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Log confirmation
console.log('[Prisma] Client initialized')
console.log('[Prisma] DATABASE_URL contains pgbouncer=true:', process.env.DATABASE_URL?.includes('pgbouncer=true'))
console.log('[Prisma] PRISMA_DISABLE_PREPARED_STATEMENTS =', process.env.PRISMA_DISABLE_PREPARED_STATEMENTS)
