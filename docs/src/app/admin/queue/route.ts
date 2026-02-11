import { NextRequest, NextResponse } from 'next/server'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { generationQueue } from '@/lib/queue/generation-queue'
import { verifyToken } from '@/lib/jwt'

// Crear Bull Board con nuestra cola
const { router: bullBoardRouter } = createBullBoard([
  new BullMQAdapter(generationQueue.getQueueInstance())
])

/**
 * GET /admin/queue
 *
 * Sirve la interfaz de Bull Board para monitoreo de colas
 * Requiere autenticación de admin
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación de admin
    const token = request.cookies.get('admin_token')?.value
    if (!token || !verifyToken(token)) {
      return NextResponse.json({
        success: false,
        error: 'Acceso no autorizado. Requiere credenciales de admin.'
      }, { status: 401 })
    }

    // Bull Board espera un objeto Express-like request/response
    // Vamos a simular esto para Next.js

    const mockReq = {
      method: 'GET',
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      query: Object.fromEntries(request.nextUrl.searchParams.entries())
    }

    const mockRes: any = {
      statusCode: 200,
      headers: {},
      body: '',

      setHeader(name: string, value: string) {
        this.headers[name] = value
      },

      getHeader(name: string) {
        return this.headers[name]
      },

      status(code: number) {
        this.statusCode = code
        return this
      },

      send(body: any) {
        this.body = body
        return this
      },

      json(body: any) {
        this.body = JSON.stringify(body)
        this.headers['Content-Type'] = 'application/json'
        return this
      },

      end(body?: any) {
        if (body) this.body = body
        return this
      }
    }

    // Ejecutar Bull Board router
    await new Promise((resolve, reject) => {
      const next = (err?: any) => {
        if (err) reject(err)
        else resolve(undefined)
      }

      bullBoardRouter(mockReq as any, mockRes, next)
    })

    // Convertir respuesta de Bull Board a NextResponse
    const response = new NextResponse(mockRes.body, {
      status: mockRes.statusCode,
      headers: mockRes.headers
    })

    return response

  } catch (error) {
    console.error('[BullBoard] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}