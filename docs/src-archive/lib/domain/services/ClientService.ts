import { Client } from '../entities/Client'
import { ClientRepository } from '../../../infrastructure/repositories/SupabaseClientRepository'
import { ValidationError } from '../../types'
import { z } from 'zod'

// Input schemas
const createClientSchema = z.object({
  name: z.string().min(3, 'Nombre debe tener mínimo 3 caracteres').max(100),
  email: z.string().email('Email inválido').optional(),
  website: z.string().url('Website debe ser URL válida').optional(),
  limit: z.number().int().positive().max(1000000).optional().default(5000)
})

const updateClientSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  active: z.boolean().optional(),
  limit: z.number().int().positive().max(1000000).optional()
})

const addDomainSchema = z.object({
  clientId: z.string().min(1, 'Client ID requerido'),
  domain: z.string().min(3, 'Dominio inválido').max(253)
})

export interface CreateClientInput {
  name: string
  email?: string
  website?: string
  limit?: number
}

export interface UpdateClientInput {
  clientId: string
  name?: string
  email?: string
  website?: string
  active?: boolean
  limit?: number
}

export interface AddDomainInput {
  clientId: string
  domain: string
}

export class ClientService {
  constructor(private clientRepository: ClientRepository) {}

  async createClient(input: CreateClientInput): Promise<{
    client: Client
    apiKey: string
  }> {
    try {
      // Validar input
      const validated = createClientSchema.parse(input)

      // Generar API key
      const apiKey = this.generateApiKey()

      // Crear cliente en repositorio
      const clientData = await this.clientRepository.create({
        name: validated.name,
        email: validated.email,
        website: validated.website,
        apiKey,
        limit: validated.limit
      })

      const client = Client.fromData(clientData)

      return {
        client,
        apiKey
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0].message)
      }
      throw error
    }
  }

  async updateClient(input: UpdateClientInput): Promise<Client> {
    try {
      const validated = updateClientSchema.parse(input)

      // Aquí iría lógica para actualizar cliente
      // Por ahora solo validamos
      throw new Error('Update client not implemented yet')

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0].message)
      }
      throw error
    }
  }

  async authenticate(apiKey: string): Promise<Client> {
    const clientData = await this.clientRepository.findByApiKey(apiKey)

    if (!clientData) {
      throw new ValidationError('Invalid API key')
    }

    const client = Client.fromData(clientData)

    if (!client.isActive()) {
      throw new ValidationError('Client is not active')
    }

    return client
  }

  async addAllowedDomain(input: AddDomainInput): Promise<void> {
    try {
      const validated = addDomainSchema.parse(input)

      // Verificar que el cliente existe
      const client = await this.authenticateById(validated.clientId)

      // Agregar dominio
      await this.clientRepository.addAllowedDomain(client.apiKey, validated.domain)

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0].message)
      }
      throw error
    }
  }

  async getClientMetrics(apiKey: string): Promise<{
    totalGenerations: number
    lastGeneration: Date | null
    monthlyUsage: number
  }> {
    const client = await this.authenticate(apiKey)
    return this.clientRepository.getMetrics(apiKey)
  }

  private async authenticateById(clientId: string): Promise<Client> {
    // Esta función necesita ser implementada en el repository
    // Por ahora usamos un approach diferente
    throw new Error('authenticateById not implemented')
  }

  private generateApiKey(): string {
    const prefix = 'tryon_'
    const randomPart = Math.random().toString(36).substring(2, 15)
    const timestamp = Date.now().toString(36).substring(4)
    return `${prefix}${randomPart}${timestamp}`
  }
}