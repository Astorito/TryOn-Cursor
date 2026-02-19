/**
 * SupabaseClientRepository - Stub para compilación
 * Este archivo es un stub que permite que el código compile.
 * En un proyecto real, implementaría operaciones CRUD de clientes.
 */

import { Client } from '@/lib/domain/entities/Client'

export interface ClientRepository {
  create(data: any): Promise<Client>
  findById(id: string): Promise<Client | null>
  findByApiKey(apiKey: string): Promise<Client | null>
  update(id: string, data: any): Promise<Client>
  delete(id: string): Promise<void>
  list(): Promise<Client[]>
  authenticate(apiKey: string): Promise<Client | null>
}

export class SupabaseClientRepository implements ClientRepository {
  async create(data: any): Promise<Client> {
    throw new Error('Not implemented in stub')
  }

  async findById(id: string): Promise<Client | null> {
    return null
  }

  async findByApiKey(apiKey: string): Promise<Client | null> {
    return null
  }

  async update(id: string, data: any): Promise<Client> {
    throw new Error('Not implemented in stub')
  }

  async delete(id: string): Promise<void> {
    throw new Error('Not implemented in stub')
  }

  async list(): Promise<Client[]> {
    return []
  }

  async authenticate(apiKey: string): Promise<Client | null> {
    return null
  }
}
