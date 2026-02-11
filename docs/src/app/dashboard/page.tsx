import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { ClientManager } from '@/components/dashboard/ClientManager'
import { IntegrationsGuide } from '@/components/dashboard/IntegrationsGuide'
import { MetricsCard } from '@/components/dashboard/MetricsCard'
import { ClientService } from '@/lib/domain/services/ClientService'
import { SupabaseClientRepository } from '@/infrastructure/repositories/SupabaseClientRepository'

// Initialize services
const clientRepository = new SupabaseClientRepository()
const clientService = new ClientService(clientRepository)

async function getDemoMetrics() {
  try {
    const metrics = await clientService.getClientMetrics('demo_key_tryon_2024')
    return metrics
  } catch (error) {
    console.error('Error getting metrics:', error)
    return {
      totalGenerations: 0,
      lastGeneration: null,
      monthlyUsage: 0
    }
  }
}

export default async function DashboardPage() {
  const metrics = await getDemoMetrics()

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <MetricsCard
            title="Cliente Demo"
            value="demo_key_tryon_2024"
            description="Activo con 1000 usos disponibles"
            color="blue"
          />
          <MetricsCard
            title="Generaciones Totales"
            value={metrics.totalGenerations.toString()}
            description="Usos realizados hasta ahora"
            color="green"
          />
          <MetricsCard
            title="Usos Mensuales"
            value={metrics.monthlyUsage.toString()}
            description="Este mes"
            color="purple"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <ClientManager />
            <IntegrationsGuide demoKey="demo_key_tryon_2024" />
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Estado del Sistema</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">API Endpoints</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ✅ Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">FAL AI Integration</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ✅ Ready
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Supabase Database</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ✅ Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Widget JavaScript</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ✅ Active
                </span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h4 className="font-medium text-blue-900 mb-2">🚀 Próximos Pasos</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Crear más clientes en el formulario</li>
                <li>• Copiar scripts de integración</li>
                <li>• Probar el widget en páginas web</li>
                <li>• Monitorear métricas en tiempo real</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}