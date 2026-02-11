export class Generation {
  private constructor(
    public readonly id: string,
    public readonly clientId: string,
    private _status: GenerationStatus,
    private readonly personImageUrl: string,
    private readonly garmentUrls: string[],
    private readonly inputsHash?: string,
    private _resultUrl?: string,
    private _error?: string,
    private _durationMs?: number,
    private _falDurationMs?: number,
    private readonly createdAt: Date = new Date(),
    private _startedAt?: Date,
    private _completedAt?: Date
  ) {}

  static create(params: {
    id: string
    clientId: string
    personImageUrl: string
    garmentUrls: string[]
    inputsHash?: string
  }): Generation {
    return new Generation(
      params.id,
      params.clientId,
      GenerationStatus.QUEUED,
      params.personImageUrl,
      params.garmentUrls,
      params.inputsHash
    )
  }

  static fromData(data: any): Generation {
    return new Generation(
      data.id,
      data.client_id || data.clientId,
      data.status,
      data.person_image_url || data.personImageUrl,
      data.garment_urls || data.garmentUrls,
      data.inputs_hash || data.inputsHash,
      data.result_url || data.resultUrl,
      data.error,
      data.duration_ms || data.durationMs,
      data.fal_duration_ms || data.falDurationMs,
      new Date(data.created_at || data.createdAt),
      data.started_at ? new Date(data.started_at) : undefined,
      data.completed_at ? new Date(data.completed_at) : undefined
    )
  }

  // Getters
  get status(): GenerationStatus { return this._status }
  get resultUrl(): string | undefined { return this._resultUrl }
  get error(): string | undefined { return this._error }
  get durationMs(): number | undefined { return this._durationMs }
  get falDurationMs(): number | undefined { return this._falDurationMs }
  get startedAt(): Date | undefined { return this._startedAt }
  get completedAt(): Date | undefined { return this._completedAt }

  // Business logic methods
  startProcessing(): void {
    this._status = GenerationStatus.PROCESSING
    this._startedAt = new Date()
  }

  complete(resultUrl: string, totalDuration: number, falDuration: number): void {
    this._status = GenerationStatus.COMPLETED
    this._resultUrl = resultUrl
    this._durationMs = totalDuration
    this._falDurationMs = falDuration
    this._completedAt = new Date()
  }

  fail(errorMessage: string): void {
    this._status = GenerationStatus.ERROR
    this._error = errorMessage
    this._completedAt = new Date()
  }

  isProcessing(): boolean {
    return this._status === GenerationStatus.PROCESSING
  }

  isCompleted(): boolean {
    return this._status === GenerationStatus.COMPLETED
  }

  isFailed(): boolean {
    return this._status === GenerationStatus.ERROR
  }

  // Validation
  canBeProcessed(): boolean {
    return this._status === GenerationStatus.QUEUED
  }

  hasValidInputs(): boolean {
    return this.personImageUrl &&
           this.garmentUrls.length > 0 &&
           this.garmentUrls.length <= 3 &&
           this.garmentUrls.every(url => url && url.startsWith('http'))
  }
}

export enum GenerationStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}