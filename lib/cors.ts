import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Helper de CORS dinámico.
 *
 * Para endpoints públicos (widget, generación): CORS abierto.
 * Para endpoints con restricción por cliente: valida contra AllowedDomain.
 */

const OPEN_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  "Access-Control-Max-Age": "86400",
};

/**
 * Agrega headers CORS abiertos a una respuesta.
 * Usado para endpoints públicos como /api/widget.
 */
export function withCors(response: NextResponse): NextResponse {
  Object.entries(OPEN_CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

/**
 * Crea una respuesta JSON con CORS abierto.
 */
export function corsJson(data: unknown, status = 200): NextResponse {
  return withCors(NextResponse.json(data, { status }));
}

/**
 * Respuesta OPTIONS para preflight CORS.
 */
export function corsOptions(): NextResponse {
  return new NextResponse(null, { status: 204, headers: OPEN_CORS_HEADERS });
}

/**
 * Verifica si un origin está permitido para un cliente específico.
 * Si el cliente no tiene dominios configurados, permite todo (backwards compat).
 */
export async function isOriginAllowed(
  clientId: string,
  origin: string | null
): Promise<boolean> {
  if (!origin) return true; // Requests sin origin (curl, server-side)

  const domains = await prisma.allowedDomain.findMany({
    where: { clientId },
    select: { domain: true },
  });

  // Si no tiene dominios configurados, permitir todo
  if (domains.length === 0) return true;

  const hostname = new URL(origin).hostname;
  return domains.some(
    (d) => hostname === d.domain || hostname.endsWith(`.${d.domain}`)
  );
}
