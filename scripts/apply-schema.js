const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    console.log('Ejecutando ALTER TABLE para agregar columnas financieras si no existen...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \"Client\"
      ADD COLUMN IF NOT EXISTS \"tier\" TEXT NOT NULL DEFAULT 'free',
      ADD COLUMN IF NOT EXISTS \"credits\" INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS \"creditsUsed\" INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS \"lastPurchaseDate\" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS \"monthlyRevenue\" DOUBLE PRECISION NOT NULL DEFAULT 0;
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS \"Client_tier_idx\" ON \"Client\"(\"tier\");`);
    console.log('ALTER TABLE ejecutado correctamente.');
  } catch (e) {
    console.error('Error aplicando ALTER TABLE:', e.message || e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
