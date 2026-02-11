# AI INTEGRATION - Integración con Modelos de IA

## Tabla de Contenidos

- [Modelo actual](#modelo-actual)
- [Clientes de IA implementados](#clientes-de-ia-implementados)
- [Flujo de inferencia síncrono](#flujo-de-inferencia-síncrono)
- [Flujo de inferencia asíncrono](#flujo-de-inferencia-asíncrono)
- [Pre-upload de imágenes](#pre-upload-de-imágenes)
- [Diferencias sync vs async](#diferencias-sync-vs-async)
- [Proveedores alternativos](#proveedores-alternativos)
- [Variables de entorno](#variables-de-entorno)
- [Troubleshooting](#troubleshooting)

---

## Modelo Actual

| Aspecto | Detalle |
|---|---|
| **Proveedor** | FAL AI |
| **Modelo** | `fal-ai/nano-banana-pro/edit` |
| **Tipo** | Image editing / Virtual try-on |
| **Documentación** | https://fal.ai/models/fal-ai/nano-banana-pro/edit |
| **SDK** | `@fal-ai/client` v1.8.1 |
| **Costo estimado** | ~$0.01-0.05 por imagen |
| **Latencia típica** | 5-8 segundos |
| **Resolución de entrada** | Recomendada: 768×512 px |
| **Resolución de salida** | Variable, generada por el modelo |

### Cómo funciona el modelo

El modelo `nano-banana-pro/edit` es un modelo de edición de imágenes que permite:

1. **Input**: Una imagen de una persona + una imagen de una prenda.
2. **Output**: La persona "vistiendo" la prenda.
3. **Mecanismo**: El modelo "entiende" la pose de la persona y la forma de la prenda, y genera una imagen combinada.

### Límites del modelo

- **Una prenda a la vez**: El modelo procesa una prenda por llamada.
- **Calidad variable**: Funciona mejor con fotos claras, fondo simple, y prendas bien recortadas.
- **Sin control fino**: No se puede especificar dónde exactamente colocar la prenda (el modelo decide).
- **Tamaño de imagen**: Imágenes muy grandes aumentan latencia sin mejorar calidad.

---

## Clientes de IA Implementados

### 1. `lib/fal-client.ts` - Cliente Síncrono

```typescript
// Configuración
fal.config({
  credentials: process.env.FAL_KEY || process.env.FAL_API_KEY || '',
});

const FAL_MODEL = 'fal-ai/nano-banana-pro/edit';
```

**Interface de entrada:**
```typescript
interface GenerateInput {
  userImage: string;    // base64 o URL
  garments: string[];   // base64 o URLs (1-4 prendas)
}
```

**Interface de salida:**
```typescript
interface FalTryOnResponse {
  resultImage: string;  // URL de la imagen generada en FAL CDN
  success: boolean;
  error?: string;
  timings?: RequestTimings;
}
```

**Llamada al modelo:**
```typescript
const result = await fal.subscribe(FAL_MODEL, {
  input: {
    person_image: currentImage,
    garment_image: garmentImage,
  },
});
```

**Procesamiento de múltiples prendas (serial):**
```
Prenda 1: person_image = foto original → resultado 1
Prenda 2: person_image = resultado 1   → resultado 2
Prenda 3: person_image = resultado 2   → resultado final
```

### 2. `lib/fal-async.ts` - Procesador Asíncrono

```typescript
const FAL_MODEL = 'fal-ai/nano-banana-pro/edit';
```

**Diferencia clave**: Este cliente usa un prompt textual + `image_urls` array:

```typescript
const result = await fal.subscribe(FAL_MODEL, {
  input: {
    prompt: "Add the clothing garment from Figure 2 onto the person in Figure 1...",
    image_urls: [personImage, ...garmentImages],
  },
});
```

**Espera de resultado:**
```typescript
const data = result.data as { images?: Array<{ url: string }> };
const imageUrl = data.images[0].url;
```

### 3. `lib/banana-client.ts` - Cliente Legacy (Stub)

```typescript
const BANANA_PRO_API_URL = process.env.BANANA_PRO_API_URL || 'https://api.banana.dev/v4/inference';
const BANANA_PRO_API_KEY = process.env.BANANA_PRO_API_KEY || '';
```

**Estado**: No implementado. Es un stub que simula una generación:
- Espera 2 segundos (`setTimeout`)
- Devuelve la imagen original del usuario sin modificar
- Existe como placeholder para un proveedor alternativo (Banana.dev)

---

## Flujo de Inferencia Síncrono

### Endpoint: `POST /api/images/generate`

```
Config: maxDuration = 60s, dynamic = 'force-dynamic'

1. Parse request body
2. Detect cold start
3. Log timing: be_request_received
4. Validate apiKey → auth.ts
5. Log timing: be_auth_done
6. Log timing: be_fal_request_sent
7. generateWithFal({ userImage, garments })
   ├─ Para cada prenda (serial):
   │   ├─ fal.subscribe(model, { person_image, garment_image })
   │   ├─ Esperar resultado (~5-8s por prenda)
   │   ├─ Log timing: fal_call_N
   │   └─ Usar resultado como person_image para la siguiente
   └─ Return: { resultImage: URL, success: true, timings }
8. recordEvent() → métricas
9. Log timing: be_fal_response_received
10. Return JSON response con timings
```

**Tiempos típicos:**
- 1 prenda: ~6s total
- 2 prendas: ~12s total (2 × ~6s serial)
- 3 prendas: ~18s total (3 × ~6s serial)

**Timeout**: 60s configurado en el handler. Vercel Free tiene límite de 10s (Pro: 60s).

### Response exitosa:

```json
{
  "success": true,
  "resultImage": "https://fal.media/files/...",
  "metadata": {
    "generatedAt": "2026-01-15T10:30:00Z",
    "inputsCount": { "garments": 2 },
    "timings": {
      "requestId": "abc123",
      "be_received_ts": 1737000000000,
      "be_response_sent_ts": 1737000006000,
      "total_backend_ms": 6000,
      "fal_duration_ms": 5500,
      "backend_overhead_ms": 500,
      "cold_start": false
    }
  }
}
```

---

## Flujo de Inferencia Asíncrono

### Endpoint: `POST /api/jobs/submit`

```
1. Verificar Redis configurado
2. Parse y validar body
3. Generar job_id
4. Crear job en Redis → status: 'queued'
5. processJobAsync() ← FIRE & FORGET (sin await)
6. Responder inmediatamente con job_id (<300ms)

Background (processJobAsync):
7. markJobProcessing(jobId) → Redis: status='processing', fal_start=now
8. Preparar prompt + image_urls
9. fal.subscribe(model, { prompt, image_urls })
10. Si OK: markJobDone(jobId, imageUrl) → Redis: status='done', image_url=URL
11. Si error: markJobError(jobId, errorMessage) → Redis: status='error'
```

### Polling: `GET /api/jobs/{id}/status`

```json
// Cuando processing:
{ "status": "processing", "image_url": null, "error": null, "timestamps": { ... } }

// Cuando done:
{ "status": "done", "image_url": "https://fal.media/files/...", "error": null, "timestamps": { ... } }

// Cuando error:
{ "status": "error", "image_url": null, "error": "FAL no devolvió imagen", "timestamps": { ... } }
```

---

## Pre-upload de Imágenes

### Endpoint: `POST /api/images/upload`

Sube una imagen a FAL Storage CDN para que FAL acceda más rápido durante inferencia.

```
1. Parse body: { apiKey, image (base64) }
2. Validar API key
3. Convertir base64 → Buffer → Blob → File
4. fal.storage.upload(file) → URL del CDN
5. Devolver URL
```

**Beneficio**: FAL accede a su propio CDN en ~10ms vs decodificar base64 del request (~1-2s extra).

**Response:**
```json
{
  "success": true,
  "url": "https://fal.media/files/upload-1234567890.jpeg",
  "uploadTime": 450
}
```

---

## Diferencias Sync vs Async

| Aspecto | Sync (`/images/generate`) | Async (`/jobs/submit`) |
|---|---|---|
| **Response time** | ~6-18s (blocking) | <300ms (immediate) |
| **Cómo funciona** | Espera a FAL y devuelve resultado | Crea job, procesa en background |
| **Obtener resultado** | En la misma response | Polling a `/jobs/{id}/status` |
| **Requiere Redis** | No | Sí |
| **Riesgo de timeout** | Alto (>10s en free tier) | Bajo |
| **Input format** | `person_image` + `garment_image` (campos) | `prompt` + `image_urls` (array) |
| **Múltiples prendas** | Serial (una a una) | Una sola llamada con prompt |
| **Instrumentación** | Detallada con timings | Básica con fase start/end |

> **Bug potencial**: Los dos clientes usan el mismo modelo pero con inputs diferentes. `fal-client.ts` usa `person_image`/`garment_image`, mientras `fal-async.ts` usa `prompt`/`image_urls`. Esto puede producir resultados inconsistentes.

---

## Proveedores Alternativos

### FAL AI (Actual)
- **Pros**: SDK simple, CDN integrado, buenos modelos, serverless-friendly.
- **Cons**: Dependencia de un solo proveedor, costos pueden escalar.
- **URL**: https://fal.ai

### Banana.dev (Stub implementado)
- **Pros**: Self-hosted posible, control total.
- **Cons**: Requiere más infraestructura, no implementado.
- **Status**: Solo existe `lib/banana-client.ts` como placeholder.

### Replicate (No implementado)
- **Pros**: Gran variedad de modelos, API simple.
- **Cons**: Latencia puede ser mayor.
- **URL**: https://replicate.com

### RunPod (No implementado)
- **Pros**: GPU dedicadas, serverless endpoints.
- **Cons**: Más complejo de configurar.
- **URL**: https://runpod.io

---

## Variables de Entorno

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `FAL_KEY` | Sí | - | API key de FAL AI (preferida) |
| `FAL_API_KEY` | Alternativa | - | API key de FAL AI (fallback) |
| `BANANA_PRO_API_KEY` | No | `''` | API key de Banana.dev (no implementado) |
| `BANANA_PRO_API_URL` | No | `https://api.banana.dev/v4/inference` | URL de Banana.dev |

### Prioridad de credenciales FAL

```typescript
fal.config({
  credentials: process.env.FAL_KEY || process.env.FAL_API_KEY || '',
});
```

Si ambas están vacías, las llamadas a FAL fallarán con error de autenticación.

---

## Troubleshooting

### Error: "FAL API error: ..."

**Causa**: Error en la llamada a FAL.
**Diagnóstico**: Los logs incluyen:
```json
{
  "message": "error message",
  "status": 400,
  "body": { "detail": "..." },
  "stack": "..."
}
```
**Soluciones**:
- Verificar que `FAL_KEY` está configurada.
- Verificar que la imagen no está corrupta.
- Verificar que la imagen es suficientemente grande (mínimo ~256px).

### Error: "Se requiere al menos una prenda"

**Causa**: El array de garments está vacío o solo contiene nulls.
**Solución**: Verificar que el frontend envía al menos un garment válido.

### Error: "Error generando imagen - no image returned"

**Causa**: FAL procesó pero no devolvió imagen.
**Soluciones**:
- La imagen de persona puede no contener una persona clara.
- La imagen de prenda puede no ser reconocible como prenda.
- El modelo puede estar sobrecargado (retry).

### Latencia muy alta (>15s)

**Causas posibles**:
1. Cold start del serverless (~2s extra).
2. Múltiples garments (×N segundos por cada prenda).
3. Imágenes muy grandes (no comprimidas).
4. FAL sobrecargado (variabilidad natural).

**Diagnóstico**: Revisar los `timings` en la response para identificar qué fase tarda más.

---

> **Referencias**: Ver [PERFORMANCE_AND_OPTIMIZATION.md](PERFORMANCE_AND_OPTIMIZATION.md) para estrategias de reducción de latencia, y [API_REFERENCE.md](API_REFERENCE.md) para los formatos exactos de request/response.
