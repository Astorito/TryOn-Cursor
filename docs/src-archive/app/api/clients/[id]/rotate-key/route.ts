import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '../../../../../lib/jwt'
import { generateApiKey } from '../../../../../lib/generate-api-key'

function corsJson(data: any, status = 200) {
  const response = NextResponse.json(data, { status })
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

// Configuración temporal - TODO: Reemplazar con base de datos
const CLIENTS_DB: Record<string, { id: string; name: string; apiKey: string }> = {
  'demo_client': {
    id: 'demo_client',
    name: 'Demo Store TryOn',
    apiKey: 'demo_key_tryon_2024'
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

    const clientId = params.id

    // Buscar cliente (en implementación real, buscar en BD)
    const client = CLIENTS_DB[clientId]
    if (!client) {
      return corsJson({ success: false, error: 'Cliente no encontrado' }, 404)
    }

    // Generar nueva API key
    const newApiKey = generateApiKey()

    // Actualizar cliente (en implementación real, guardar en BD)
    client.apiKey = newApiKey

    return corsJson({
      success: true,
      newApiKey,
      message: 'API key rotada exitosamente. Actualizá tu código de integración.',
      client: {
        id: client.id,
        name: client.name,
        apiKey: newApiKey
      }
    })

  } catch (error) {
    console.error('Error rotating API key:', error)
    return corsJson({
      success: false,
      error: 'Error interno del servidor'
    }, 500)
  }
}