import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Actualizando clientes con datos financieros...");

  // Datos de ejemplo para clientes
  const clientesEjemplo = [
    {
      nombre: "TechCorp Global",
      tier: "enterprise",
      credits: 30000,
      creditsUsed: 24500,
      monthlyRevenue: 299,
      lastPurchaseDate: new Date("2023-10-12"),
    },
    {
      nombre: "Innovate AI",
      tier: "professional",
      credits: 50000,
      creditsUsed: 12100,
      monthlyRevenue: 99,
      lastPurchaseDate: new Date("2023-11-05"),
    },
    {
      nombre: "DataSphere Systems",
      tier: "enterprise",
      credits: 10100,
      creditsUsed: 8450,
      monthlyRevenue: 299,
      lastPurchaseDate: new Date("2023-09-20"),
    },
    {
      nombre: "FutureSoft Inc",
      tier: "starter",
      credits: 10000,
      creditsUsed: 2200,
      monthlyRevenue: 29,
      lastPurchaseDate: new Date("2023-11-15"),
    },
  ];

  // Obtener clientes existentes
  const clientes = await prisma.client.findMany({
    orderBy: { createdAt: "asc" },
    take: clientesEjemplo.length,
  });

  if (clientes.length === 0) {
    console.log("⚠️  No hay clientes en la base de datos. Creando datos de ejemplo...");
    
    for (const ejemplo of clientesEjemplo) {
      await prisma.client.create({
        data: {
          name: ejemplo.nombre,
          email: `${ejemplo.nombre.toLowerCase().replace(/\s+/g, "")}@example.com`,
          apiKey: `test_${Math.random().toString(36).substring(2, 15)}`,
          active: true,
          tier: ejemplo.tier,
          credits: ejemplo.credits,
          creditsUsed: ejemplo.creditsUsed,
          monthlyRevenue: ejemplo.monthlyRevenue,
          lastPurchaseDate: ejemplo.lastPurchaseDate,
        },
      });
    }
    
    console.log("✅ Clientes de ejemplo creados");
  } else {
    // Actualizar clientes existentes con datos financieros
    for (let i = 0; i < Math.min(clientes.length, clientesEjemplo.length); i++) {
      const cliente = clientes[i];
      const ejemplo = clientesEjemplo[i];

      await prisma.client.update({
        where: { id: cliente.id },
        data: {
          tier: ejemplo.tier,
          credits: ejemplo.credits,
          creditsUsed: ejemplo.creditsUsed,
          monthlyRevenue: ejemplo.monthlyRevenue,
          lastPurchaseDate: ejemplo.lastPurchaseDate,
        },
      });

      console.log(`✅ Actualizado: ${cliente.name} -> ${ejemplo.tier}`);
    }
  }

  console.log("✅ Datos financieros actualizados correctamente");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
