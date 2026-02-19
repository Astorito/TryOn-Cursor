// Ensure Prisma disables prepared statements as early as possible in the runtime
if (!process.env.PRISMA_DISABLE_PREPARED_STATEMENTS) {
  process.env.PRISMA_DISABLE_PREPARED_STATEMENTS = '1'
}

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './src/lib/jwt'
import { logger } from './src/lib/logger'
import { randomUUID } from 'crypto'

// Configuración temporal de dominios permitidos por API key
// TODO: Mover esto a base de datos cuando se implemente Supabase completo
const CLIENT_DOMAINS: Record<string, string[]> = {
  'demo_key_tryon_2024': ['*'], // Demo permite todos por ahora
  // Ejemplo: 'api_key_cliente_1': ['tienda1.com', 'tienda1.net']
}

function getApiKeyFromRequest(request: NextRequest): string | null {
  // Buscar API key en diferentes lugares
  const urlApiKey = request.nextUrl.searchParams.get('apiKey')
  const headerApiKey = request.headers.get('x-api-key')

  // Para POST requests, buscar en body (simplificado)
  if (request.method === 'POST' && !urlApiKey && !headerApiKey) {
    // Nota: En un middleware real, no podemos leer el body fácilmente
    // Esto sería manejado en el endpoint específico
    return null
  }

  return urlApiKey || headerApiKey
}

function isOriginAllowed(origin: string | null, apiKey: string | null): boolean {
  // Si no hay API key, denegar
  if (!apiKey) return false

  // Si no hay origen (requests locales), permitir
  if (!origin) return true

  const allowedDomains = CLIENT_DOMAINS[apiKey]
  if (!allowedDomains) return false

  // Si incluye '*', permitir todos
  if (allowedDomains.includes('*')) return true

  // Verificar si el origen está en la lista permitida
  return allowedDomains.some(domain => {
    // Quitar protocolo si existe
    const cleanOrigin = origin.replace(/^https?:\/\//, '')
    return cleanOrigin.includes(domain)
  })
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const method = request.method

  // Generate unique request ID for tracing
  const requestId = randomUUID()

  // Add request ID to headers for use in routes
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)

  // Clone request with new headers
  const newRequest = new NextRequest(request.url, {
    ...request,
    headers: requestHeaders
  })

  // Log incoming request
  logger.info('Request received', {
    requestId,
    method,
    path: pathname,
    userAgent: request.headers.get('user-agent')?.substring(0, 100),
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
  })

  // Proteger /dashboard/*
  if (pathname.startsWith("/dashboard")) {
    const token = request.cookies.get('admin_token')?.value

    if (!token) {
      logger.warn('No admin token provided for dashboard access', {
        requestId,
        path: pathname,
        ip: request.headers.get('x-forwarded-for')
      })
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Nota: La verificación completa del JWT se hace en el layout del dashboard
    // Aquí solo verificamos que la cookie existe para evitar requests innecesarios
  }

  // CORS dinámico para API
  if (pathname.startsWith("/api/")) {
    const origin = request.headers.get('origin')
    const response = NextResponse.next()

    // Copy request ID to response for client-side debugging
    response.headers.set('x-request-id', requestId)

    // Endpoints que requieren validación CORS por cliente
    const clientProtectedEndpoints = [
      '/api/widget',
      '/api/images/generate'
    ]

    const needsOriginValidation = clientProtectedEndpoints.some(endpoint =>
      pathname === endpoint || pathname.startsWith(endpoint)
    )

    if (needsOriginValidation) {
      const apiKey = getApiKeyFromRequest(request)

      if (!isOriginAllowed(origin, apiKey)) {
        logger.warn('CORS validation failed', {
          requestId,
          origin,
          path: pathname,
          apiKey: apiKey?.substring(0, 10) + '...'
        })
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: 'Origin not allowed for this API key',
            requestId
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      // CORS dinámico: permitir solo el origen validado
      if (origin) {
        response.headers.set('Access-Control-Allow-Origin', origin)
      }
    } else {
      // Endpoints admin/setup: CORS abierto
      response.headers.set('Access-Control-Allow-Origin', '*')
    }

    // Headers CORS comunes
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key')

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: response.headers })
    }

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*"]
}