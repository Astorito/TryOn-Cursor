export class Client {
  private constructor(
    public readonly id: string,
    private readonly name: string,
    private readonly apiKey: string,
    private readonly email?: string,
    private readonly website?: string,
    private readonly _active: boolean = true,
    private readonly _limit: number = 5000,
    private readonly _tier: string = 'free',
    private readonly createdAt: Date = new Date(),
    private readonly updatedAt: Date = new Date(),
    private readonly _allowedDomains: string[] = []
  ) {}

  static create(params: {
    id: string
    name: string
    apiKey: string
    email?: string
    website?: string
    active?: boolean
    limit?: number
    tier?: string
    allowedDomains?: string[]
  }): Client {
    return new Client(
      params.id,
      params.name,
      params.apiKey,
      params.email,
      params.website,
      params.active ?? true,
      params.limit ?? 5000,
      params.tier ?? 'free',
      new Date(),
      new Date(),
      params.allowedDomains ?? []
    )
  }

  static fromData(data: any): Client {
    return new Client(
      data.id,
      data.name,
      data.api_key || data.apiKey,
      data.email,
      data.website,
      data.active ?? true,
      data.limit ?? 5000,
      data.tier ?? 'free',
      new Date(data.created_at || data.createdAt),
      new Date(data.updated_at || data.updatedAt),
      data.allowed_domains?.map((d: any) => d.domain) || []
    )
  }

  // Getters
  get name(): string { return this.name }
  get apiKey(): string { return this.apiKey }
  get email(): string | undefined { return this.email }
  get website(): string | undefined { return this.website }
  get active(): boolean { return this._active }
  get limit(): number { return this._limit }
  get tier(): string { return this._tier }
  get allowedDomains(): string[] { return [...this._allowedDomains] }
  get createdAt(): Date { return this.createdAt }
  get updatedAt(): Date { return this.updatedAt }

  // Business logic methods
  isActive(): boolean {
    return this._active
  }

  canMakeGeneration(): boolean {
    return this._active
  }

  hasAllowedDomain(domain: string): boolean {
    if (this._allowedDomains.length === 0) return true // Allow all if no restrictions
    return this._allowedDomains.some(allowedDomain =>
      this.normalizeDomain(domain) === this.normalizeDomain(allowedDomain)
    )
  }

  private normalizeDomain(domain: string): string {
    return domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  }
}