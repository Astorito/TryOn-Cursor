'use client'

import { useState } from 'react'

interface TierSelectorProps {
  clientId: string
  currentTier: string
}

const TIERS = [
  { value: 'free', label: 'Free - 5 req/min, 100/day', price: 'Gratis' },
  { value: 'starter', label: 'Starter - 20 req/min, 1000/day', price: '$9/mes' },
  { value: 'pro', label: 'Pro - 60 req/min, 5000/day', price: '$29/mes' },
  { value: 'enterprise', label: 'Enterprise - 200 req/min, 50000/day', price: '$99/mes' }
]

export function TierSelector({ clientId, currentTier }: TierSelectorProps) {
  const [tier, setTier] = useState(currentTier)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function updateTier(newTier: string) {
    setLoading(true)
    setMessage('')

    try {
      // TODO: Implementar endpoint para actualizar tier
      const response = await fetch(`/api/clients/${clientId}/tier`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: newTier })
      })

      const data = await response.json()

      if (data.success) {
        setTier(newTier)
        setMessage('✅ Tier actualizado exitosamente')
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('❌ Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '1rem',
      marginTop: '1rem'
    }}>
      <h3 style={{
        margin: '0 0 1rem 0',
        color: '#374151',
        fontSize: '1.125rem',
        fontWeight: '600'
      }}>
        💎 Plan Actual: {TIERS.find(t => t.value === tier)?.label || tier}
      </h3>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{
          display: 'block',
          marginBottom: '0.5rem',
          color: '#374151',
          fontWeight: '500'
        }}>
          Cambiar Plan:
        </label>
        <select
          value={tier}
          onChange={e => updateTier(e.target.value)}
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '0.875rem'
          }}
        >
          {TIERS.map(t => (
            <option key={t.value} value={t.value}>
              {t.label} - {t.price}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.5rem',
          borderRadius: '4px',
          fontSize: '0.875rem',
          background: message.includes('✅') ? '#d1fae5' : '#fee2e2',
          color: message.includes('✅') ? '#065f46' : '#991b1b'
        }}>
          {message}
        </div>
      )}

      <div style={{
        marginTop: '1rem',
        padding: '0.75rem',
        background: '#f0f9ff',
        border: '1px solid #0ea5e9',
        borderRadius: '4px'
      }}>
        <p style={{
          margin: '0',
          fontSize: '0.75rem',
          color: '#0c4a6e'
        }}>
          <strong>💡 Información:</strong> Los límites de rate se aplican por minuto y por día.
          El cambio de plan es inmediato pero puede tomar unos minutos para aplicarse completamente.
        </p>
      </div>
    </div>
  )
}