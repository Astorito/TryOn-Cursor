# API REFERENCE - Referencia Completa de API

## Tabla de Contenidos

- [Base URL](#base-url)
- [Autenticación](#autenticación)
- [CORS](#cors)
- [Endpoints Widget/Generación](#endpoints-widgetgeneración)
  - [GET /api/widget](#get-apiwidget)
  - [POST /api/images/generate](#post-apiimagesgenerate)
  - [POST /api/images/upload](#post-apiimagesupload)
- [Endpoints Async Jobs](#endpoints-async-jobs)
  - [POST /api/jobs/submit](#post-apijobssubmit)
  - [GET /api/jobs/:id/status](#get-apijobsidstatus)
  - [GET /api/jobs/health](#get-apijobshealth)
- [Endpoints Admin/Dashboard](#endpoints-admindashboard)
  - [POST /api/auth/login](#post-apiauthlogin)
  - [GET /api/clients](#get-apiclients)
  - [POST /api/clients](#post-apiclients)
  - [PUT /api/clients](#put-apiclients)
  - [DELETE /api/clients](#delete-apiclients)
  - [GET /api/metrics](#get-apimetrics)
  - [POST /api/ingest](#post-apiingest)
  - [GET /api/admin/analytics](#get-apiadminanalytics)
- [Endpoints Health](#endpoints-health)
  - [GET /api/health](#get-apihealth)
- [Códigos de error comunes](#códigos-de-error-comunes)
- [Rate Limiting](#rate-limiting)

---

## Base URL

| Entorno | URL |
|---|---|
| Producción | `https://tryon-backend-definitivo.vercel.app` |
| Local | `http://localhost:3000` |

---

## Autenticación

### API Key (Para endpoints de generación)

Se envía en el body de la request:

```json
{
  "apiKey": "demo_key_12345"
}
```

**Claves hardcoded disponibles:**

| API Key | Client ID | Company |
|---|---|---|
| `demo_key_12345` | `demo_client` | Demo Client |
| `demotryon01` | `demotryon01` | Demo TryOn 01 |
| `testtryon01` | `testtryon01` | Test TryOn 01 |

### Admin Key (Para endpoints de gestión)

Se envía como query parameter `key` o en el body:

```
GET /api/clients?key=admin_key
GET /api/metrics?key=admin_key
```

La clave admin se define en `ADMIN_KEY` env var.

### Cookie Session (Para el dashboard)

El login en `/api/auth/login` setea una cookie `admin_session=authenticated` que se valida en el middleware para rutas `/dashboard/*`.

---

## CORS

Configurado globalmente en el middleware y en `next.config.js`:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, x-api-key
```

Todos los endpoints responden a `OPTIONS` con status `200`.

---

## Endpoints Widget/Generación

---

### GET /api/widget

Sirve el archivo JavaScript del widget (`lib/widget-core.js`).

**Request:**
```bash
curl https://api.example.com/api/widget
```

**Response:**
- **Content-Type**: `application/javascript`
- **Status**: `200 OK`
- **Body**: Contenido raw de `widget-core.js` (~1507 líneas)
- **Cache**: `public, max-age=3600`

**Headers de respuesta adicionales:**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET
Access-Control-Allow-Headers: Content-Type
```

**Uso en HTML:**
```html
<script src="https://api.example.com/api/widget" defer></script>
```

---

### POST /api/images/generate

Genera una imagen de virtual try-on de forma síncrona. Espera a que FAL complete la inferencia antes de responder.

**Config:** `maxDuration = 60`, `dynamic = 'force-dynamic'`

**Request:**
```bash
curl -X POST https://api.example.com/api/images/generate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "demo_key_12345",
    "userImage": "data:image/jpeg;base64,/9j/4AAQ...",
    "garments": [
      "data:image/jpeg;base64,/9j/4AAQ...",
      "data:image/jpeg;base64,/9j/4AAQ..."
    ]
  }'
```

**Body:**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `apiKey` | string | Sí | API key del cliente |
| `userImage` | string | Sí | Imagen de la persona (base64 o URL) |
| `garments` | string[] | Sí | Array de imágenes de prendas (base64 o URL, 1-4 prendas) |

**Response exitosa (200):**
```json
{
  "success": true,
  "resultImage": "https://fal.media/files/abc123/result.png",
  "metadata": {
    "generatedAt": "2026-01-15T10:30:00.000Z",
    "inputsCount": {
      "garments": 2
    },
    "timings": {
      "requestId": "gen_1737000000000_abc1234",
      "be_received_ts": 1737000000000,
      "be_auth_done_ts": 1737000000050,
      "be_fal_request_sent_ts": 1737000000055,
      "be_fal_response_received_ts": 1737000006000,
      "be_response_sent_ts": 1737000006010,
      "total_backend_ms": 6010,
      "fal_duration_ms": 5945,
      "backend_overhead_ms": 65,
      "cold_start": false
    }
  }
}
```

**Response error (400):**
```json
{
  "success": false,
  "error": "Se requiere al menos una prenda"
}
```

**Response error (401):**
```json
{
  "success": false,
  "error": "API key inválida o no proporcionada"
}
```

**Response error (500):**
```json
{
  "success": false,
  "error": "Error generando imagen",
  "details": "FAL API error: ..."
}
```

---

### POST /api/images/upload

Pre-sube una imagen al CDN de FAL Storage para acceso rápido durante inferencia.

**Request:**
```bash
curl -X POST https://api.example.com/api/images/upload \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "demo_key_12345",
    "image": "data:image/jpeg;base64,/9j/4AAQ..."
  }'
```

**Body:**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `apiKey` | string | Sí | API key del cliente |
| `image` | string | Sí | Imagen en base64 |

**Response exitosa (200):**
```json
{
  "success": true,
  "url": "https://fal.media/files/upload-1234567890.jpeg",
  "uploadTime": 450
}
```

**Response error (400):**
```json
{
  "success": false,
  "error": "Se requiere imagen"
}
```

**Response error (401):**
```json
{
  "success": false,
  "error": "API key inválida"
}
```

---

## Endpoints Async Jobs

---

### POST /api/jobs/submit

Crea un job asíncrono para try-on. Responde inmediatamente con un `jobId`. Requiere Redis.

**Request:**
```bash
curl -X POST https://api.example.com/api/jobs/submit \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "demo_key_12345",
    "personImage": "data:image/jpeg;base64,/9j/4AAQ...",
    "garmentImages": [
      "data:image/jpeg;base64,/9j/4AAQ..."
    ]
  }'
```

**Body:**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `apiKey` | string | Sí | API key del cliente |
| `personImage` | string | Sí | Imagen de la persona (base64 o URL) |
| `garmentImages` | string[] | Sí | Array de imágenes de prendas |

**Response exitosa (202):**
```json
{
  "success": true,
  "jobId": "job_1737000000000_abc1234",
  "statusUrl": "/api/jobs/job_1737000000000_abc1234/status",
  "estimatedTime": "15-30 seconds"
}
```

**Response error (400):**
```json
{
  "success": false,
  "error": "Se requiere personImage y al menos una garmentImage"
}
```

**Response error (503):**
```json
{
  "success": false,
  "error": "Async jobs not available - Redis not configured"
}
```

---

### GET /api/jobs/:id/status

Consulta el status actual de un job asíncrono.

**Request:**
```bash
curl https://api.example.com/api/jobs/job_1737000000000_abc1234/status
```

**Parámetros URL:**

| Parámetro | Tipo | Descripción |
|---|---|---|
| `id` | string | ID del job retornado por `/jobs/submit` |

**Response - Queued (200):**
```json
{
  "status": "queued",
  "image_url": null,
  "error": null,
  "timestamps": {
    "created_at": "2026-01-15T10:30:00.000Z"
  }
}
```

**Response - Processing (200):**
```json
{
  "status": "processing",
  "image_url": null,
  "error": null,
  "timestamps": {
    "created_at": "2026-01-15T10:30:00.000Z",
    "fal_start": "2026-01-15T10:30:00.500Z"
  }
}
```

**Response - Done (200):**
```json
{
  "status": "done",
  "image_url": "https://fal.media/files/abc123/result.png",
  "error": null,
  "timestamps": {
    "created_at": "2026-01-15T10:30:00.000Z",
    "fal_start": "2026-01-15T10:30:00.500Z",
    "fal_end": "2026-01-15T10:30:06.000Z"
  }
}
```

**Response - Error (200):**
```json
{
  "status": "error",
  "image_url": null,
  "error": "FAL no devolvió imagen",
  "timestamps": {
    "created_at": "2026-01-15T10:30:00.000Z",
    "fal_start": "2026-01-15T10:30:00.500Z",
    "fal_end": "2026-01-15T10:30:03.000Z"
  }
}
```

**Response - Not Found (404):**
```json
{
  "error": "Job not found (may have expired)"
}
```

> **Nota**: Los jobs expiran después de 1 hora (TTL 3600s en Redis).

---

### GET /api/jobs/health

Verifica que Redis esté disponible y funcional.

**Request:**
```bash
curl https://api.example.com/api/jobs/health
```

**Response exitosa (200):**
```json
{
  "status": "ok",
  "redis": "connected",
  "timestamp": "2026-01-15T10:30:00.000Z"
}
```

**Response error (500):**
```json
{
  "status": "error",
  "redis": "disconnected",
  "error": "Connection refused"
}
```

---

## Endpoints Admin/Dashboard

---

### POST /api/auth/login

Autenticación del dashboard admin. Setea cookie de sesión.

**Request:**
```bash
curl -X POST https://api.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "password": "tryon_admin_2024"
  }'
```

**Body:**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `password` | string | Sí | Contraseña del admin |

**Response exitosa (200):**
```json
{
  "success": true,
  "message": "Login exitoso"
}
```

**Headers de response:**
```
Set-Cookie: admin_session=authenticated; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400
```

**Response error (401):**
```json
{
  "success": false,
  "error": "Contraseña incorrecta"
}
```

---

### GET /api/clients

Lista todas las empresas registradas.

**Request:**
```bash
curl "https://api.example.com/api/clients?key=ADMIN_KEY"
```

**Query params:**

| Param | Tipo | Requerido | Descripción |
|---|---|---|---|
| `key` | string | Sí | Admin key |

**Response exitosa (200):**
```json
{
  "clients": [
    {
      "id": "empresa_abc",
      "name": "Empresa ABC",
      "apiKey": "emp_abc_key",
      "website": "https://empresa.com",
      "active": true,
      "createdAt": "2026-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### POST /api/clients

Crea una nueva empresa.

**Request:**
```bash
curl -X POST https://api.example.com/api/clients \
  -H "Content-Type: application/json" \
  -d '{
    "key": "ADMIN_KEY",
    "name": "Nueva Empresa",
    "website": "https://nueva.com"
  }'
```

**Body:**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `key` | string | Sí | Admin key |
| `name` | string | Sí | Nombre de la empresa |
| `website` | string | No | URL del sitio web |

**Response exitosa (201):**
```json
{
  "success": true,
  "client": {
    "id": "nueva_empresa_abc123",
    "name": "Nueva Empresa",
    "apiKey": "generated_api_key_xyz",
    "website": "https://nueva.com",
    "active": true,
    "createdAt": "2026-01-15T10:30:00.000Z"
  }
}
```

> **Nota importante**: Las empresas creadas aquí se almacenan en memoria. No persisten tras redeploy. Además, sus API keys NO se registran en `lib/auth.ts`, por lo que **no pueden usar** `/api/images/generate`.

---

### PUT /api/clients

Actualiza una empresa existente.

**Request:**
```bash
curl -X PUT https://api.example.com/api/clients \
  -H "Content-Type: application/json" \
  -d '{
    "key": "ADMIN_KEY",
    "id": "empresa_abc",
    "name": "Nombre Actualizado",
    "active": false
  }'
```

**Body:**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `key` | string | Sí | Admin key |
| `id` | string | Sí | ID de la empresa a actualizar |
| `name` | string | No | Nuevo nombre |
| `website` | string | No | Nueva URL |
| `active` | boolean | No | Estado activo/inactivo |

**Response exitosa (200):**
```json
{
  "success": true,
  "client": { ... }
}
```

---

### DELETE /api/clients

Elimina una empresa.

**Request:**
```bash
curl -X DELETE "https://api.example.com/api/clients?key=ADMIN_KEY&id=empresa_abc"
```

**Query params:**

| Param | Tipo | Requerido | Descripción |
|---|---|---|---|
| `key` | string | Sí | Admin key |
| `id` | string | Sí | ID de la empresa a eliminar |

**Response exitosa (200):**
```json
{
  "success": true,
  "message": "Cliente eliminado"
}
```

---

### GET /api/metrics

Obtiene métricas de uso del sistema.

**Request:**
```bash
# Con admin key (todas las métricas):
curl "https://api.example.com/api/metrics?key=ADMIN_KEY"

# Con API key de cliente (solo métricas propias):
curl "https://api.example.com/api/metrics?apiKey=demo_key_12345"
```

**Query params:**

| Param | Tipo | Requerido | Descripción |
|---|---|---|---|
| `key` | string | Alt. | Admin key (acceso total) |
| `apiKey` | string | Alt. | API key del cliente (acceso propio) |

**Response exitosa (200):**
```json
{
  "metrics": {
    "demo_client": [
      {
        "type": "generation",
        "timestamp": "2026-01-15T10:30:00.000Z",
        "data": {
          "garments": 2,
          "success": true,
          "duration_ms": 6000
        }
      }
    ]
  },
  "summary": {
    "totalEvents": 150,
    "totalClients": 3
  }
}
```

---

### POST /api/ingest

Ingesta de eventos de métricas desde el widget u otros clientes.

**Request:**
```bash
curl -X POST https://api.example.com/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "event": "widget_open",
    "clientId": "demo_client",
    "timestamp": "2026-01-15T10:30:00.000Z",
    "data": {
      "page": "https://tienda.com/producto/123"
    }
  }'
```

**Body:**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `event` | string | Sí | Tipo de evento |
| `clientId` | string | Sí | ID del cliente |
| `timestamp` | string | No | Timestamp ISO (default: now) |
| `data` | object | No | Datos adicionales del evento |

**Tipos de eventos soportados:**
- `widget_open` — El usuario abre el widget
- `widget_close` — El usuario cierra el widget
- `image_upload` — El usuario sube una foto
- `garment_select` — El usuario selecciona una prenda
- `generation_start` — Comienza la generación
- `generation_complete` — Generación exitosa
- `generation_error` — Error en la generación

**Response exitosa (200):**
```json
{
  "success": true,
  "message": "Event ingested"
}
```

---

### GET /api/admin/analytics

Datos analíticos para los charts del dashboard.

**Request:**
```bash
curl "https://api.example.com/api/admin/analytics" \
  -H "Cookie: admin_session=authenticated"
```

**Query params:**

| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `period` | string | `7d` | Periodo: `24h`, `7d`, `30d`, `90d` |
| `clientId` | string | `all` | Filtrar por cliente |

**Response exitosa (200):**
```json
{
  "success": true,
  "data": {
    "timeSeries": [
      { "date": "2026-01-15", "generations": 45, "errors": 2 }
    ],
    "hourlyDistribution": [
      { "hour": 0, "count": 5 },
      { "hour": 1, "count": 2 }
    ],
    "clientRanking": [
      { "clientId": "demo_client", "total": 150, "success": 145, "errors": 5 }
    ],
    "eventDistribution": [
      { "type": "widget_open", "count": 500 },
      { "type": "generation_complete", "count": 150 }
    ],
    "summary": {
      "totalGenerations": 150,
      "successRate": 96.7,
      "avgLatency": 6200,
      "activeClients": 3
    }
  }
}
```

**Response error (401):**
```json
{
  "success": false,
  "error": "No autorizado"
}
```

---

## Endpoints Health

---

### GET /api/health

Health check del sistema con warm-up de procesos.

**Request:**
```bash
curl https://api.example.com/api/health
```

**Response exitosa (200):**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "services": {
    "fal": "configured",
    "redis": "connected"
  }
}
```

> **Warm-up**: Este endpoint importa `fal-client.ts` para que el módulo quede en memoria, reduciendo cold starts en la siguiente llamada a `/images/generate`.

---

## Códigos de Error Comunes

| Código | Significado | Causas comunes |
|---|---|---|
| `200` | OK | Operación exitosa |
| `201` | Created | Recurso creado (POST /clients) |
| `202` | Accepted | Job aceptado (POST /jobs/submit) |
| `400` | Bad Request | Campos faltantes, formato inválido |
| `401` | Unauthorized | API key inválida, no autenticado |
| `404` | Not Found | Job no encontrado o expirado |
| `405` | Method Not Allowed | Método HTTP incorrecto |
| `500` | Internal Server Error | Error de procesamiento, FAL error |
| `503` | Service Unavailable | Redis no configurado |

---

## Rate Limiting

**Estado actual: NO IMPLEMENTADO**

No hay rate limiting en ningún endpoint. Cualquier cliente puede hacer llamadas ilimitadas.

**Recomendación**: Implementar rate limiting por API key usando Upstash Redis ratelimit:

```typescript
import { Ratelimit } from "@upstash/ratelimit";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "60 s"), // 10 req/min
});
```

---

> **Referencias**: Ver [SECURITY.md](SECURITY.md) para detalles de autenticación, y [AI_INTEGRATION.md](AI_INTEGRATION.md) para detalles del modelo FAL.
