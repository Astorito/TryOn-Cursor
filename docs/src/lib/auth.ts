import jwt from 'jsonwebtoken'
import { logger } from './logger'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_dev_secret_change_in_production'

export interface AuthResult {
  valid: boolean
  error?: string
  client?: any
}

/**
 * Crea un token JWT para admin
 */
export function createAdminToken(): string {
  return jwt.sign(
    {
      role: 'admin',
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

/**
 * Verifica un token JWT de admin
 */
export function verifyAdminToken(token: string): boolean {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    return decoded.role === 'admin'
  } catch {
    return false
  }
}

/**
 * Valida credenciales de admin
 */
export function validateAdminCredentials(username: string, password: string): boolean {
  // Verificar que las variables de entorno estén configuradas
  if (!process.env.ADMIN_PASSWORD) {
    logger.error('ADMIN_PASSWORD not configured in environment variables')
    throw new Error('ADMIN_PASSWORD no está configurado en las variables de entorno')
  }

  // Verificar que el username sea correcto (por ahora fijo)
  if (username !== 'admin') {
    return false
  }

  // Verificar password
  return password === process.env.ADMIN_PASSWORD
}