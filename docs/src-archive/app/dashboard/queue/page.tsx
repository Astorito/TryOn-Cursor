'use client'

import { useState, useEffect } from 'react'

interface QueueStats {
  queue: {
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
    total: number
  }
  workers: {
    isRunning: boolean
    waitingCount: number
    activeCount: number
    totalJobs: number
  }
  performance: {
    throughputJobsPerMinute: number
    avgProcessingTimeMs: number
    errorRate: number
  }
  recentFailed: Array<{
    id: string
    name: string
    failedReason: string
    failedAt: Date
    attemptsMade: number
  }>
  config: {
    workerConcurrency: number
    maxRetries: number
    cacheEnabled: boolean
    r2Enabled: boolean
  }
}

export default function QueueDashboardPage() {
  const [stats, setStats] = useState<QueueStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Cargar estadísticas
  const loadStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/queue/stats')
      const data = await response.json()

      if (data.success) {
        setStats(data.data)
        setError(null)
      } else {
        setError(data.error || 'Error cargando estadísticas')
      }
    } catch (err) {
      setError('Error de conexión')
      console.error('Error loading queue stats:', err)
    } finally {
      setLoading(false)
      setLastUpdate(new Date())
    }
  }

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando estadísticas de cola...</p>
        </div>
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">❌ Error</div>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={loadStats}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">📊 Monitoreo de Cola</h1>
          <p className="mt-2 text-gray-600">
            Estado en tiempo real del sistema de procesamiento de TryOn
          </p>
          <div className="mt-4 flex items-center space-x-4">
            <button
              onClick={loadStats}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '🔄 Actualizando...' : '🔄 Actualizar'}
            </button>
            <span className="text-sm text-gray-500">
              Última actualización: {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
        </div>

        {stats && (
          <div className="space-y-8">
            {/* Estadísticas principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="En Espera"
                value={stats.queue.waiting}
                icon="⏳"
                color="blue"
              />
              <StatCard
                title="Procesando"
                value={stats.queue.active}
                icon="⚙️"
                color="green"
              />
              <StatCard
                title="Completados"
                value={stats.queue.completed}
                icon="✅"
                color="purple"
              />
              <StatCard
                title="Fallidos"
                value={stats.queue.failed}
                icon="❌"
                color="red"
              />
            </div>

            {/* Rendimiento */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">⚡ Rendimiento</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.performance.throughputJobsPerMinute.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-600">Jobs/minuto</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {(stats.performance.avgProcessingTimeMs / 1000).toFixed(1)}s
                  </div>
                  <div className="text-sm text-gray-600">Tiempo promedio</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {stats.performance.errorRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">Tasa de error</div>
                </div>
              </div>
            </div>

            {/* Estado de Workers */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">👷 Workers</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${stats.workers.isRunning ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.workers.isRunning ? '✅' : '❌'}
                  </div>
                  <div className="text-sm text-gray-600">Estado</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.workers.activeCount}
                  </div>
                  <div className="text-sm text-gray-600">Activos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {stats.workers.waitingCount}
                  </div>
                  <div className="text-sm text-gray-600">Esperando</div>
                </div>
              </div>
            </div>

            {/* Configuración */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">⚙️ Configuración</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ConfigItem label="Concurrencia" value={stats.config.workerConcurrency.toString()} />
                <ConfigItem label="Max Reintentos" value={stats.config.maxRetries.toString()} />
                <ConfigItem label="Cache" value={stats.config.cacheEnabled ? '✅' : '❌'} />
                <ConfigItem label="R2 Storage" value={stats.config.r2Enabled ? '✅' : '❌'} />
              </div>
            </div>

            {/* Jobs fallidos recientes */}
            {stats.recentFailed.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">❌ Jobs Fallidos Recientes</h2>
                <div className="space-y-3">
                  {stats.recentFailed.map((job) => (
                    <div key={job.id} className="border border-red-200 rounded p-3 bg-red-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900">{job.id}</div>
                          <div className="text-sm text-red-600 mt-1">{job.failedReason}</div>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          <div>{job.attemptsMade} intentos</div>
                          <div>{new Date(job.failedAt).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Componente para tarjetas de estadísticas
function StatCard({ title, value, icon, color }: {
  title: string
  value: number
  icon: string
  color: 'blue' | 'green' | 'purple' | 'red'
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    purple: 'bg-purple-100 text-purple-800',
    red: 'bg-red-100 text-red-800'
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className={`text-2xl ${colorClasses[color]} rounded-full p-3`}>
            {icon}
          </div>
        </div>
        <div className="ml-5">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

// Componente para items de configuración
function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-semibold text-gray-900">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  )
}