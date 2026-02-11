'use client'

import { useState } from 'react'

interface ApiKeyManagerProps {
  clientId: string
  currentApiKey: string
  clientName: string
}

export function ApiKeyManager({ clientId, currentApiKey, clientName }: ApiKeyManagerProps) {
  const [apiKey, setApiKey] = useState(currentApiKey)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  async function rotateApiKey() {
    setLoading(true)
    setMessage('')
    setShowConfirm(false)

    try {
      const response = await fetch(`/api/clients/${clientId}/rotate-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (data.success) {
        setApiKey(data.newApiKey)
        setMessage('✅ API key rotada exitosamente')
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('❌ Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setMessage('📋 API key copiada al portapapeles')
    setTimeout(() => setMessage(''), 3000)
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
        🔑 Gestión de API Key
      </h3>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{
          display: 'block',
          marginBottom: '0.5rem',
          color: '#374151',
          fontWeight: '500'
        }}>
          API Key Actual:
        </label>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <code style={{
            background: '#f3f4f6',
            padding: '0.5rem',
            borderRadius: '4px',
            fontFamily: 'monospace',
            flex: 1,
            wordBreak: 'break-all'
          }}>
            {apiKey}
          </code>
          <button
            onClick={() => copyToClipboard(apiKey)}
            style={{
              padding: '0.5rem',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            title="Copiar al portapapeles"
          >
            📋
          </button>
        </div>
      </div>

      {/* Mensajes */}
      {message && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          borderRadius: '4px',
          fontSize: '0.875rem',
          background: message.includes('✅') ? '#d1fae5' : '#fee2e2',
          color: message.includes('✅') ? '#065f46' : '#991b1b',
          border: `1px solid ${message.includes('✅') ? '#a7f3d0' : '#fecaca'}`
        }}>
          {message}
        </div>
      )}

      {/* Confirmación de rotación */}
      {showConfirm ? (
        <div style={{
          marginBottom: '1rem',
          padding: '1rem',
          background: '#fef3c7',
          border: '1px solid #fbbf24',
          borderRadius: '4px'
        }}>
          <p style={{
            margin: '0 0 1rem 0',
            color: '#92400e',
            fontWeight: '500'
          }}>
            ⚠️ ¿Estás seguro de rotar la API key?
          </p>
          <p style={{
            margin: '0 0 1rem 0',
            color: '#92400e',
            fontSize: '0.875rem'
          }}>
            Esta acción invalidará la API key actual y generará una nueva.
            Todos los sitios web que usen la key actual dejarán de funcionar
            hasta que actualices el código de integración.
          </p>
          <div style={{
            display: 'flex',
            gap: '0.5rem'
          }}>
            <button
              onClick={rotateApiKey}
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem'
              }}
            >
              {loading ? 'Rotando...' : 'Sí, rotar API key'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              style={{
                padding: '0.5rem 1rem',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}
        >
          🔄 Rotar API Key
        </button>
      )}

      {/* Información de seguridad */}
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
          <strong>🔒 Recomendación de seguridad:</strong> Rota las API keys periódicamente
          y cuando sospeches de un compromiso. Actualiza inmediatamente el código
          de integración en todos tus sitios web después de rotar.
        </p>
      </div>
    </div>
  )
}