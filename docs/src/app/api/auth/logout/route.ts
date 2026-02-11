import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: 'Logout exitoso'
  })

  // Eliminar la cookie del token
  response.cookies.set('admin_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // Expirar inmediatamente
    path: '/' // Asegurar que se elimine de todo el sitio
  })

  return response
}