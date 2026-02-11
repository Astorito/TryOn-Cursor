import { prisma } from "@/lib/db";
import type { Client } from "@prisma/client";

/**
 * Validación de API Keys contra la tabla Client en Supabase (PostgreSQL + Prisma).
 *
 * Reemplaza el antiguo sistema de API keys hardcodeadas.
 * Cada llamada consulta la DB; en el futuro se puede agregar caché in-memory con TTL corto.
 */

export interface AuthResult {
  valid: boolean;
  client: Client | null;
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
