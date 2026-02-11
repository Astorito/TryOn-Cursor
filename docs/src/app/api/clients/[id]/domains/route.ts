import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'

// Configuración temporal - TODO: Reemplazar con base de datos
const CLIENT_DOMAINS: Record<string, string[]> = {
  'demo_key_tryon_2024': ['*'],
}

function corsJson(data: any, status = 200) {
  const response = NextResponse.json(data, { status })
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticación admin
    const token = request.cookies.get('admin_token')?.value
    if (!token || !verifyToken(token)) {
      return corsJson({ success: false, error: 'No autorizado' }, 401)
    }

    const clientId = params.id
    const domains = CLIENT_DOMAINS[clientId] || []

    return corsJson({
      success: true,
      domains: domains.filter(d => d !== '*') // No mostrar el comodín
    })

  } catch (error) {
    console.error('Error getting domains:', error)
    return corsJson({ success: false, error: 'Error interno' }, 500)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticación admin
    const token = request.cookies.get('admin_token')?.value
    if (!token || !verifyToken(token)) {
      return corsJson({ success: false, error: 'No autorizado' }, 401)
    }

    const { domain } = await request.json()
    const clientId = params.id

    if (!domain) {
      return corsJson({ success: false, error: 'Dominio requerido' }, 400)
    }

    // Validar formato de dominio
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/
    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0]

    if (!domainRegex.test(cleanDomain)) {
      return corsJson({ success: false, error: 'Formato de dominio inválido' }, 400)
    }

    // Agregar dominio (en implementación real, guardar en BD)
    if (!CLIENT_DOMAINS[clientId]) {
      CLIENT_DOMAINS[clientId] = []
    }

    if (!CLIENT_DOMAINS[clientId].includes(cleanDomain)) {
      CLIENT_DOMAINS[clientId].push(cleanDomain)
    }

    return corsJson({ success: true })

  } catch (error) {
    console.error('Error adding domain:', error)
    return corsJson({ success: false, error: 'Error interno' }, 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticación admin
    const token = request.cookies.get('admin_token')?.value
    if (!token || !verifyToken(token)) {
      return corsJson({ success: false, error: 'No autorizado' }, 401)
    }

    const { domain } = await request.json()
    const clientId = params.id

    if (!domain) {
      return corsJson({ success: false, error: 'Dominio requerido' }, 400)
    }

    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0]

    // Remover dominio
    if (CLIENT_DOMAINS[clientId]) {
      CLIENT_DOMAINS[clientId] = CLIENT_DOMAINS[clientId].filter(d => d !== cleanDomain)
    }

    return corsJson({ success: true })

  } catch (error) {
    console.error('Error removing domain:', error)
    return corsJson({ success: false, error: 'Error interno' }, 500)
  }
}