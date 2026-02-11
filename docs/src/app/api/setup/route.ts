import { NextResponse } from 'next/server'
import { ClientService } from '@/lib/domain/services/ClientService'
import { SupabaseClientRepository } from '@/infrastructure/repositories/SupabaseClientRepository'

// Initialize services
const clientRepository = new SupabaseClientRepository()
const clientService = new ClientService(clientRepository)

export async function GET() {
  try {
    console.log('🚀 Inicializando sistema TryOn...')

    // Verificar si el cliente demo ya existe
    try {
      const existingClient = await clientService.authenticate('demo_key_tryon_2024')

      console.log('✅ Cliente demo ya existe:', existingClient.name)

      return NextResponse.json({
        success: true,
        message: 'Sistema ya inicializado',
        client: {
          id: existingClient.id,
          name: existingClient.name,
          api_key: existingClient.apiKey,
          active: existingClient.active
        },
        integration: {
          code: `<script src="http://localhost:3000/api/widget.js" data-tryon-key="${existingClient.apiKey}"></script>`,
          instructions: [
            'El script ya está listo para usar',
            'Cópialo en tu HTML antes del </body>',
            'El widget aparecerá como un botón flotante'
          ]
        },
        dashboard: 'http://localhost:3000/dashboard'
      })

    } catch (error) {
      // Cliente no existe, crearlo
      console.log('📝 Creando cliente demo...')
    }

    // Crear cliente demo
    const result = await clientService.createClient({
      name: 'Demo Store TryOn',
      email: 'demo@tryon.com',
      website: 'https://demostoretryon.com',
      limit: 1000
    })

    console.log('✅ Cliente demo creado:', result.client.name)

    return NextResponse.json({
      success: true,
      message: '🎉 Sistema TryOn inicializado exitosamente!',
      client: {
        id: result.client.id,
        name: result.client.name,
        api_key: result.apiKey,
        active: result.client.active,
        limit: result.client.limit
      },
      integration: {
        code: `<script src="http://localhost:3000/api/widget.js" data-tryon-key="${result.apiKey}"></script>`,
        instructions: [
          '1. Copia el código de integración arriba',
          '2. Pégalo en tu HTML antes del </body>',
          '3. El widget aparecerá como un botón flotante "✨ Try Look"',
          '4. Los usuarios podrán subir fotos y prendas',
          '5. El sistema generará imágenes de virtual try-on'
        ]
      },
      dashboard: 'http://localhost:3000/dashboard',
      endpoints: {
        widget: 'http://localhost:3000/api/widget.js',
        generate: 'http://localhost:3000/api/images/generate',
        metrics: 'http://localhost:3000/api/metrics'
      },
      next_steps: [
        'Accede al dashboard para ver métricas',
        'Crea nuevos clientes para otros sitios',
        'Integra el widget en páginas web',
        'Monitorea el uso en tiempo real'
      ]
    })

  } catch (error) {
    console.error('❌ Error en setup:', error)
    return NextResponse.json({
      success: false,
      message: 'Error inicializando el sistema',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, website, limit = 5000 } = body

    if (!name) {
      return NextResponse.json({
        success: false,
        message: 'Nombre es requerido'
      }, { status: 400 })
    }

    // Crear nuevo cliente
    const result = await clientService.createClient({
      name,
      email,
      website,
      limit
    })

    return NextResponse.json({
      success: true,
      client: {
        id: result.client.id,
        name: result.client.name,
        api_key: result.apiKey,
        script: `<script src="http://localhost:3000/api/widget.js" data-tryon-key="${result.apiKey}"></script>`
      }
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Error creating client',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}