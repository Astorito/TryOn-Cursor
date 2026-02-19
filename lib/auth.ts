import { prisma } from "@/lib/db";
import type { Client, AllowedDomain } from "@prisma/client";
import jwt from 'jsonwebtoken'

/**
 * Validación de API Keys contra la tabla Client en Supabase (PostgreSQL + Prisma).
 *
 * Reemplaza el antiguo sistema de API keys hardcodeadas.
 * Cada llamada consulta la DB; en el futuro se puede agregar caché in-memory con TTL corto.
 */

export interface AuthResult {
  valid: boolean;
  client: (Client & { allowedDomains?: AllowedDomain[] }) | null;
  error?: string;
}

/**
 * Valida una API key y devuelve el cliente asociado.
 * Retorna `valid: false` si la key no existe o el cliente está inactivo.
 */
export async function validateApiKey(apiKey: string): Promise<AuthResult> {
  if (!apiKey || typeof apiKey !== "string") {
    return { valid: false, client: null, error: "API key requerida" };
  }

  try {
    const client = await prisma.client.findUnique({
      where: { apiKey },
      include: { allowedDomains: true }
    });

    if (!client) {
      return { valid: false, client: null, error: "API key inválida" };
    }

    if (!client.active) {
      return { valid: false, client: null, error: "Cliente desactivado" };
    }

    return { valid: true, client };
  } catch (error) {
    console.error("[auth] Error validando API key:", error);
    return { valid: false, client: null, error: "Error interno de autenticación" };
  }
}

/**
 * Genera una API key única con formato: tryon_{timestamp}_{random}
 */
export function generateApiKey(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `tryon_${timestamp}_${random}`;
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_dev_secret_change_in_production'

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
  if (!process.env.ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD not configured in environment variables')
    throw new Error('ADMIN_PASSWORD no está configurado en las variables de entorno')
  }

  if (username !== 'admin') {
    return false
  }

  return password === process.env.ADMIN_PASSWORD
}
