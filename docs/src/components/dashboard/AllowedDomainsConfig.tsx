'use client'

import { useState, useEffect } from 'react'

interface AllowedDomainsConfigProps {
  clientId: string
  apiKey: string
}

export function AllowedDomainsConfig({ clientId, apiKey }: AllowedDomainsConfigProps) {
  const [domains, setDomains] = useState<string[]>([])
  const [newDomain, setNewDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Cargar dominios existentes
  useEffect(() => {
    loadDomains()
  }, [clientId])

  async function loadDomains() {
    try {
      const response = await fetch(`/api/clients/${clientId}/domains`)
      const data = await response.json()

      if (data.success) {
        setDomains(data.domains)
      }
    } catch (error) {
      console.error('Error loading domains:', error)
    }
  }

  async function addDomain() {
    if (!newDomain.trim()) return

    setLoading(true)
    setMessage('')

    try {
      const response = await fetch(`/api/clients/${clientId}/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain.trim() })
      })

      const data = await response.json()

      if (data.success) {
        setDomains([...domains, newDomain.trim()])
        setNewDomain('')
        setMessage('Dominio agregado exitosamente')
      } else {
        setMessage(data.error || 'Error al agregar dominio')
      }
    } catch (error) {
      setMessage('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  async function removeDomain(domainToRemove: string) {
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch(`/api/clients/${clientId}/domains`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domainToRemove })
      })

      const data = await response.json()

      if (data.success) {
        setDomains(domains.filter(d => d !== domainToRemove))
        setMessage('Dominio removido exitosamente')
      } else {
        setMessage(data.error || 'Error al remover dominio')
      }
    } catch (error) {
      setMessage('Error de conexión')
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
        🌐 Dominios Permitidos (CORS)
      </h3>

      <p style={{
        margin: '0 0 1rem 0',
        color: '#6b7280',
        fontSize: '0.875rem'
      }}>
        Configura qué dominios pueden usar esta API key. Si no configuras ninguno,
        solo se permitirá el acceso desde el mismo origen.
      </p>

      {/* Lista de dominios actuales */}
      {domains.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{
            margin: '0 0 0.5rem 0',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151'
          }}>
            Dominios configurados:
          </h4>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0
          }}>
            {domains.map(domain => (
              <li key={domain} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem',
                background: '#f9fafb',
                borderRadius: '4px',
                marginBottom: '0.25rem'
              }}>
                <span style={{ fontFamily: 'monospace' }}>{domain}</span>
                <button
                  onClick={() => removeDomain(domain)}
                  disabled={loading}
                  style={{
                    padding: '0.25rem 0.5rem',
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.5 : 1
                  }}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Agregar nuevo dominio */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center'
      }}>
        <input
          type="text"
          value={newDomain}
          onChange={e => setNewDomain(e.target.value)}
          placeholder="ejemplo.com"
          style={{
            flex: 1,
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '0.875rem'
          }}
          onKeyPress={e => e.key === 'Enter' && addDomain()}
        />
        <button
          onClick={addDomain}
          disabled={loading || !newDomain.trim()}
          style={{
            padding: '0.5rem 1rem',
            background: loading || !newDomain.trim() ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.875rem',
            cursor: loading || !newDomain.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Agregando...' : 'Agregar'}
        </button>
      </div>

      {/* Mensajes */}
      {message && (
        <p style={{
          margin: '0.5rem 0 0 0',
          fontSize: '0.875rem',
          color: message.includes('exitosamente') ? '#059669' : '#dc2626'
        }}>
          {message}
        </p>
      )}

      {/* Información adicional */}
      <div style={{
        marginTop: '1rem',
        padding: '0.75rem',
        background: '#fefce8',
        border: '1px solid #fbbf24',
        borderRadius: '4px'
      }}>
        <p style={{
          margin: '0',
          fontSize: '0.75rem',
          color: '#92400e'
        }}>
          <strong>💡 Tip:</strong> Usa '*' para permitir todos los dominios (solo para desarrollo).
          En producción, especifica únicamente los dominios necesarios.
        </p>
      </div>
    </div>
  )
}