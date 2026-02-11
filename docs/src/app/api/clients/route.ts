import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { createRequestLogger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || Math.random().toString(36).substring(2, 15)
  const requestLogger = createRequestLogger(requestId)

  try {
    const body = await request.json()
    const { name, email, tier = 'free', allowedDomains } = body

    if (!name || !email) {
      requestLogger.warn('Missing required fields for client creation', { name, email })
      return NextResponse.json({
        success: false,
        error: 'name y email son requeridos'
      }, { status: 400 })
    }

    // Generar API key única
    const apiKey = `tryon_${Math.random().toString(36).substring(2, 15)}`

    // Crear cliente
    const newClient = await prisma.client.create({
      data: {
        name,
        email,
        tier,
        apiKey
      }
    })

    requestLogger.info('Client created successfully', {
      clientId: newClient.id,
      name: newClient.name,
      tier: newClient.tier
    })

    // Si se envían dominios permitidos, crear los registros
    if (allowedDomains && Array.isArray(allowedDomains)) {
      const domainsData = allowedDomains.map((domain: string) => ({
        domain: domain.replace(/^https?:\/\//, '').replace(/\/$/, ''), // quitar protocolo y trailing slash
        clientId: newClient.id
      }))

      await prisma.allowedDomain.createMany({
        data: domainsData
      })

      requestLogger.info('Allowed domains created for client', {
        clientId: newClient.id,
        domains: domainsData.map(d => d.domain)
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        client: {
          id: newClient.id,
          name: newClient.name,
          email: newClient.email,
          tier: newClient.tier,
          apiKey: newClient.apiKey
        }
      }
    })

  } catch (error) {
    requestLogger.error('Error creating client', error as Error, {
      body: await request.json().catch(() => ({}))
    })

    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || Math.random().toString(36).substring(2, 15)
  const requestLogger = createRequestLogger(requestId)

  try {
    const clients = await prisma.client.findMany({
      include: {
        allowedDomains: true,
        _count: {
          select: {
            generations: true
          }
        }
      }
    })

    requestLogger.info('Clients retrieved successfully', {
      count: clients.length
    })

    return NextResponse.json({
      success: true,
      data: clients
    })

  } catch (error) {
    requestLogger.error('Error retrieving clients', error as Error)

    // Si el error es el conocido de PostgreSQL / PgBouncer: prepared statement already exists (42P05),
    // devolver una respuesta segura (200) con lista vacía y un warning para no bloquear el frontend.
    const errAny: any = error
    const msg = (errAny?.message || '').toString().toLowerCase()
    if (msg.includes('prepared statement') || msg.includes('42p05')) {
      console.error('[clients] Detected prepared-statement error, returning empty list to avoid 500', errAny)
      return NextResponse.json({
        success: true,
        data: [],
        warning: 'Database prepared statement error detected (42P05). Returning empty list temporarily.'
      }, { status: 200 })
    }

    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}