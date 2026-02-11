import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/health
 * Health check del sistema. Verifica que la API y la base de datos respondan.
 */
export async function GET() {
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: "database_unavailable",
        message: "No se pudo conectar a la base de datos",
        durationMs: Date.now() - start,
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    service: "tryon-api",
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
  });
}
