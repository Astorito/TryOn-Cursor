import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge Middleware - Se ejecuta antes de cada request
 *
 * Responsabilidades:
 * 1. CORS preflight (OPTIONS) para API routes
 * 2. CORS headers en todas las respuestas API
 *
 * Nota: Dashboard y login son abiertos; el acceso se maneja dando el código
 * de integración a cada cliente. Sin auth por ahora.
 */

// Headers CORS comunes
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  "Access-Control-Max-Age": "86400",
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── CORS para API routes ───
  if (pathname.startsWith("/api/")) {
    // Preflight (OPTIONS) → respuesta inmediata 204
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Resto de métodos → agregar headers CORS a la respuesta
    const response = NextResponse.next();
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
