import { Generation, GenerationStatus } from '@/lib/domain/entities/Generation'
import { Client } from '@/lib/domain/entities/Client'
import { FalClient } from '@/infrastructure/fal/FalClient'
import { GenerationRepository } from '@/infrastructure/repositories/SupabaseGenerationRepository'
import { ClientRepository } from '@/infrastructure/repositories/SupabaseClientRepository'
import { ValidationError, AuthenticationError } from '@/lib/types'
import { z } from 'zod'

// Input schemas
const generationInputSchema = z.object({
  apiKey: z.string().min(10, 'API key inválida'),
  userImage: z.string().url('Imagen de usuario debe ser URL válida'),
  garments: z.array(z.string().url('Cada prenda debe ser URL válida'))
    .min(1, 'Mínimo 1 prenda')
    .max(3, 'Máximo 3 prendas'),
  model: z.string().optional().default('fal-ai/nano-banana-pro/edit')
  model: z.string().optional().default('fal-ai/bytedance/seedream/v4/edit')
})

export interface GenerationResult {
  generationId: string
  resultUrl: string
  timing: {
    totalMs: number
    falMs: number
  }
}

export interface GenerationInput {
  apiKey: string
  userImage: string
  garments: string[]
  model?: string
}

export class GenerationService {
  constructor(
    private falClient: FalClient,
    private generationRepository: GenerationRepository,
    private clientRepository: ClientRepository
  ) {}

  async generate(input: GenerationInput): Promise<GenerationResult> {
    const startTime = Date.now()

    try {
      // Validar input
      const validatedInput = this.validateInput(input)

      // Autenticar cliente
      const client = await this.authenticateClient(validatedInput.apiKey)

      // Verificar límites
      await this.checkLimits(client)

      // Crear hash de inputs para caché
      const inputsHash = this.generateInputsHash(validatedInput)

      // Verificar caché
      const cachedResult = await this.checkCache(inputsHash, client.id)
      if (cachedResult) {
        return cachedResult
      }

      // Crear generación
      const generationId = `gen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

      const generation = Generation.create({
        id: generationId,
        clientId: client.id,
        personImageUrl: validatedInput.userImage,
        garmentUrls: validatedInput.garments,
        inputsHash
      })

      await this.generationRepository.create({
        id: generation.id,
        clientId: client.id,
        personImageUrl: generation.personImageUrl,
        garmentUrls: generation.garmentUrls,
        inputsHash: generation.inputsHash
      })

      // Procesar generación
      const result = await this.processGeneration(generation, validatedInput.garments)

      // Registrar éxito
      await this.generationRepository.update(generation.id, {
        status: GenerationStatus.COMPLETED,
        resultUrl: result.resultUrl,
        durationMs: result.timing.totalMs,
        falDurationMs: result.timing.falMs,
        completedAt: new Date()
      })

      return result

    } catch (error) {
      console.error('Generation error:', error)

      if (error instanceof ValidationError || error instanceof AuthenticationError) {
        throw error
      }

      throw new Error(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private validateInput(input: GenerationInput): z.infer<typeof generationInputSchema> {
    try {
      return generationInputSchema.parse(input)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0].message)
      }
      throw new ValidationError('Input validation failed')
    }
  }

  private async authenticateClient(apiKey: string): Promise<Client> {
    const clientData = await this.clientRepository.findByApiKey(apiKey)
    if (!clientData) {
      throw new AuthenticationError('Invalid API key')
    }

    const client = Client.fromData(clientData)
    if (!client.isActive()) {
      throw new AuthenticationError('Client is not active')
    }

    return client
  }

  private async checkLimits(client: Client): Promise<void> {
    // Por ahora sin límites - podemos agregar después
    return
  }

  private generateInputsHash(input: GenerationInput): string {
    const hashInput = `${input.userImage}|${input.garments.sort().join('|')}`
    // Simple hash - en producción usar crypto
    let hash = 0
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  private async checkCache(inputsHash: string, clientId: string): Promise<GenerationResult | null> {
    const cached = await this.generationRepository.findByInputsHash(inputsHash, clientId)
    if (cached) {
      return {
        generationId: cached.id,
        resultUrl: cached.resultUrl,
        timing: { totalMs: 0, falMs: 0 } // Cached result
      }
    }
    return null
  }

  private async processGeneration(generation: Generation, garments: string[]): Promise<GenerationResult> {
    const falStartTime = Date.now()

    try {
      // Usar primera prenda por ahora - después implementar múltiples
      const result = await this.falClient.generate({
        personImageUrl: generation.personImageUrl,
        garmentImageUrl: garments[0],
        seed: Math.floor(Math.random() * 1000000)
      })

      const falDuration = Date.now() - falStartTime

      return {
        generationId: generation.id,
        resultUrl: result.imageUrl,
        timing: {
          totalMs: Date.now() - falStartTime,
          falMs: falDuration
        }
      }

    } catch (error) {
      throw new Error(`FAL processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}