import { prisma } from './db'

/**
 * Utilidades CORS para validación de orígenes permitidos
 */

/**
 * Verifica si un origen está permitido para un cliente específico
 * Consulta la tabla AllowedDomain en la base de datos
 */
export async function isOriginAllowed(clientId: string, origin: string | null): Promise<boolean> {
  try {
    // Si no hay origen (requests locales), permitir
    if (!origin) {
      return true
    }

    // Normalizar el origen (quitar protocolo y trailing slash)
    const cleanOrigin = origin.replace(/^https?:\/\//, '').replace(/\/$/, '')

    // Buscar dominios permitidos para este cliente
    const allowedDomains = await prisma.allowedDomain.findMany({
      where: { clientId },
      select: { domain: true }
    })

    // Si no hay dominios configurados, permitir todos (modo legacy)
    if (allowedDomains.length === 0) {
      return true
    }

    // Verificar si el origen está en la lista permitida
    return allowedDomains.some(allowedDomain => {
      const cleanDomain = allowedDomain.domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
      return cleanOrigin === cleanDomain || cleanOrigin.endsWith('.' + cleanDomain)
    })

  } catch (error) {
    console.error('Error checking origin allowed:', error)
    // En caso de error de BD, denegar por seguridad
    return false
  }
}

/**
 * Función helper para crear respuesta JSON con headers CORS
 */
export function corsJson(data: any, status = 200, origin?: string) {
  // Esto es solo para compatibilidad - el middleware maneja los headers CORS reales
  return data
}