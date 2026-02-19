import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

/**
 * Cliente para almacenamiento en Cloudflare R2 (compatible con S3)
 *
 * - Persiste resultados de generación
 * - URLs públicas permanentes
 * - Sin egress fees (ventaja de R2)
 */

export class R2Storage {
  private client: S3Client
  private bucketName: string
  private publicUrl: string

  constructor() {
    this.bucketName = process.env.R2_BUCKET_NAME!
    this.publicUrl = process.env.R2_PUBLIC_URL!

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
      }
    })
  }

  /**
   * Persiste una imagen desde una URL externa a R2
   * @returns URL pública permanente
   */
  async persistImage(
    sourceUrl: string,
    generationId: string,
    clientId: string
  ): Promise<string> {
    try {
      // Descargar imagen del provider
      console.log(`[R2Storage] Downloading image from ${sourceUrl}`)
      const response = await fetch(sourceUrl)

      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type') || 'image/png'

      // Generar key única: {clientId}/{generationId}.{ext}
      const ext = contentType.split('/')[1] || 'png'
      const key = `results/${clientId}/${generationId}.${ext}`

      // Upload a R2
      console.log(`[R2Storage] Uploading to R2: ${key}`)
      // Evitar cargar todo el archivo en memoria cuando sea posible.
      // Si la respuesta expone un stream (response.body), pasarlo directamente al PutObjectCommand.
      // En entornos Node, fetch devuelve un stream legible que AWS SDK acepta como Body.
      let body: any
      if (response.body) {
        body = response.body as unknown as NodeJS.ReadableStream
      } else {
        // Fallback: leer como arrayBuffer (mayor uso de memoria)
        const buffer = await response.arrayBuffer()
        body = new Uint8Array(buffer)
      }

      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000', // 1 año
        })
      )

      // Retornar URL pública
      const publicUrl = `${this.publicUrl}/${key}`
      console.log(`[R2Storage] Image persisted: ${publicUrl}`)

      return publicUrl
    } catch (error) {
      console.error('[R2Storage] Error persisting image:', error)
      throw new Error(
        `Failed to persist image: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Verifica si un archivo existe en R2
   */
  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key
        })
      )
      return true
    } catch {
      return false
    }
  }

  /**
   * Genera la URL pública de un archivo
   */
  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`
  }
}