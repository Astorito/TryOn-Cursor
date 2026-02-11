import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'
import { aiRouter } from '@/lib/ai'

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación admin (opcional, pero recomendado)
    const token = request.cookies.get('admin_token')?.value
    const isAuthenticated = token && verifyToken(token)

    const statuses = await aiRouter.getProvidersStatus()

    return NextResponse.json({
      success: true,
      providers: statuses,
      config: {
        fallbackEnabled: process.env.ENABLE_AI_FALLBACK === 'true',
        cacheEnabled: process.env.ENABLE_RESULT_CACHE === 'true',
        primaryProvider: process.env.PRIMARY_AI_PROVIDER || 'fal'
      },
      authenticated: isAuthenticated,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error getting AI status:', error)
    return NextResponse.json({
      success: false,
      error: 'Error obteniendo estado de AI',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}