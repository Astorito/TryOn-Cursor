import { NextRequest, NextResponse } from 'next/server'
import { createAdminToken, validateAdminCredentials } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    // Validar credenciales usando la nueva función
    if (!validateAdminCredentials(username, password)) {
      return NextResponse.json({
        success: false,
        error: 'Credenciales inválidas'
      }, { status: 401 })
    }

    // Crear token JWT
    const token = createAdminToken()

    const response = NextResponse.json({
      success: true,
      message: 'Login exitoso'
    })

    // Setear cookie HTTP-only con el JWT
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 días
    })

    return response

  } catch (error) {
    console.error('Error en login:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}