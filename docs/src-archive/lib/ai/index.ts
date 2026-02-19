import { FalProvider } from './fal-provider'
import { AIRouter } from './router'

/**
 * Configuración y exportación del AI Router singleton
 * 
 * Este archivo inicializa el sistema de AI con los providers configurados
 */

// Inicializar FAL Provider con la API key del entorno
const falApiKey = process.env.FAL_KEY || process.env.FAL_API_KEY || ''

if (!falApiKey) {
  console.error('[AI] WARNING: FAL_KEY no está configurada en variables de entorno')
}

const falProvider = new FalProvider(falApiKey, {
  name: 'fal',
  enabled: true,
  priority: 1,
  timeout: 30000, // 30 segundos
  maxRetries: 2
})

// Crear instancia del router con el provider configurado
export const aiRouter = new AIRouter({
  providers: [falProvider],
  enableFallback: process.env.ENABLE_AI_FALLBACK === 'true',
  primaryProvider: 'fal',
  maxRetries: 2,
  timeoutMs: 30000
})

console.log('[AI] AI Router initialized with FAL provider (Nano Banana Pro / Gemini 3 Pro Image Edit)')
