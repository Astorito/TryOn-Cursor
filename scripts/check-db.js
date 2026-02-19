const { PrismaClient } = require('@prisma/client');

(async function(){
  const prisma = new PrismaClient();
  try {
    console.log('Intentando conectar a la DB...');
    const res = await prisma.$queryRaw`SELECT 1 as result`;
    console.log('Query OK:', res);
  } catch (e) {
    console.error('Error al conectar a la DB:', e.message || e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
