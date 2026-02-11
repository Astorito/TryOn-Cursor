import { PrismaClient } from "@prisma/client";

/**
 * Singleton de Prisma Client para Next.js
 *
 * En desarrollo, Next.js hace hot-reload que re-importa módulos.
 * Sin singleton, se crearían múltiples conexiones a la DB.
 * Guardamos la instancia en `globalThis` para reutilizarla.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
