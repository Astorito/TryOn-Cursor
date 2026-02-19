import { supabase } from '@/infrastructure/db/supabase'
import { GenerationRepository } from './GenerationRepository'
import { GenerationStatus } from '@/lib/domain/entities/Generation'

export class SupabaseGenerationRepository implements GenerationRepository {
  async create(data: {
    id: string
    clientId: string
    personImageUrl: string
    garmentUrls: string[]
    inputsHash?: string
  }): Promise<void> {
    const { error } = await supabase
      .from('generations')
      .insert([{
        id: data.id,
        client_id: data.clientId,
        status: GenerationStatus.QUEUED,
        person_image_url: data.personImageUrl,
        garment_urls: data.garmentUrls,
        inputs_hash: data.inputsHash,
        created_at: new Date().toISOString()
      }])

    if (error) {
      throw new Error(`Error creating generation: ${error.message}`)
    }
  }

  async update(id: string, data: {
    status?: GenerationStatus
    resultUrl?: string
    error?: string
    durationMs?: number
    falDurationMs?: number
    startedAt?: Date
    completedAt?: Date
  }): Promise<void> {
    const updateData: any = {}

    if (data.status) updateData.status = data.status
    if (data.resultUrl) updateData.result_url = data.resultUrl
    if (data.error) updateData.error = data.error
    if (data.durationMs) updateData.duration_ms = data.durationMs
    if (data.falDurationMs) updateData.fal_duration_ms = data.falDurationMs
    if (data.startedAt) updateData.started_at = data.startedAt.toISOString()
    if (data.completedAt) updateData.completed_at = data.completedAt.toISOString()

    const { error } = await supabase
      .from('generations')
      .update(updateData)
      .eq('id', id)

    if (error) {
      throw new Error(`Error updating generation: ${error.message}`)
    }
  }

  async findById(id: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('generations')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw new Error(`Error finding generation: ${error.message}`)
    }

    return data
  }

  async findByInputsHash(inputsHash: string, clientId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('generations')
      .select('id, result_url, created_at')
      .eq('inputs_hash', inputsHash)
      .eq('client_id', clientId)
      .eq('status', GenerationStatus.COMPLETED)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24h
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Error finding cached result: ${error.message}`)
    }

    return data
  }

  async getActiveGenerations(): Promise<string[]> {
    const { data, error } = await supabase
      .from('generations')
      .select('id')
      .in('status', [GenerationStatus.QUEUED, GenerationStatus.PROCESSING])

    if (error) {
      throw new Error(`Error getting active generations: ${error.message}`)
    }

    return data.map(row => row.id)
  }

  async cleanupOldGenerations(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { count, error } = await supabase
      .from('generations')
      .delete({ count: 'exact' })
      .lt('created_at', thirtyDaysAgo)
      .eq('status', GenerationStatus.COMPLETED)

    if (error) {
      throw new Error(`Error cleaning up generations: ${error.message}`)
    }

    return count || 0
  }
}