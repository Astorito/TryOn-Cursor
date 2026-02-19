'use client'

import { useState } from 'react'
import { logger } from '@/lib/logger'

interface CompanyFormData {
  name: string
  email: string
  tier: 'free' | 'pro' | 'enterprise'
  allowedDomains: string
}

interface CompanyFormProps {
  onSubmit: (data: Omit<CompanyFormData, 'allowedDomains'> & { allowedDomains: string[] }) => Promise<void>
  initialData?: Partial<CompanyFormData>
  isLoading?: boolean
}

export function CompanyForm({ onSubmit, initialData, isLoading = false }: CompanyFormProps) {
  const [formData, setFormData] = useState<CompanyFormData>({
    name: initialData?.name || '',
    email: initialData?.email || '',
    tier: initialData?.tier || 'free',
    allowedDomains: initialData?.allowedDomains || ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Convertir dominios separados por coma a array
      const allowedDomains = formData.allowedDomains
        .split(',')
        .map(d => d.trim())
        .filter(d => d.length > 0)

      await onSubmit({
        name: formData.name,
        email: formData.email,
        tier: formData.tier,
        allowedDomains
      })

      // Resetear formulario si no hay initialData
      if (!initialData) {
        setFormData({
          name: '',
          email: '',
          tier: 'free',
          allowedDomains: ''
        })
      }

    } catch (error) {
      logger.error('Error submitting company form', error as Error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Nombre de la Empresa
          </label>
          <input
            type="text"
            id="name"
            required
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Tienda XYZ"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email de Contacto
          </label>
          <input
            type="email"
            id="email"
            required
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="contacto@tiendaxyz.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="tier" className="block text-sm font-medium text-gray-700">
          Plan
        </label>
        <select
          id="tier"
          value={formData.tier}
          onChange={(e) => setFormData(prev => ({ ...prev, tier: e.target.value as CompanyFormData['tier'] }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="free">Free - 10 requests/min</option>
          <option value="pro">Pro - 50 requests/min</option>
          <option value="enterprise">Enterprise - Sin límite</option>
        </select>
      </div>

      <div>
        <label htmlFor="allowedDomains" className="block text-sm font-medium text-gray-700">
          Dominios Permitidos (separados por coma)
        </label>
        <input
          type="text"
          id="allowedDomains"
          value={formData.allowedDomains}
          onChange={(e) => setFormData(prev => ({ ...prev, allowedDomains: e.target.value }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="tiendaxyz.com, www.tiendaxyz.com, tienda.com"
        />
        <p className="mt-1 text-sm text-gray-500">
          Si se deja vacío, se permitirá cualquier origen (modo legacy)
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Creando...' : initialData ? 'Actualizar Empresa' : 'Crear Empresa'}
        </button>
      </div>
    </form>
  )
}