# ARCHITECTURE - Arquitectura Técnica Detallada

## Tabla de Contenidos

- [Diagrama de componentes](#diagrama-de-componentes)
- [Frontend - Widget](#frontend---widget)
- [Backend - Next.js API](#backend---nextjs-api)
- [Middleware](#middleware)
- [Librerías compartidas](#librerías-compartidas)
- [Deployment](#deployment)

---

## Diagrama de Componentes

```
┌──────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Widget)                           │
│                                                                      │
│  lib/widget-core.js (1507 líneas, Vanilla JS, Shadow DOM)           │
│  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ State Mgmt│  │ UI Render│  │ File I/O │  │ Image Optimizer  │   │
│  │ (object)  │  │ (DOM)    │  │ (base64) │  │ (canvas resize)  │   │
│  └─────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│        │              │             │                  │             │
│        └──────────────┴─────────────┴──────────────────┘             │
│                              │                                       │
│                     fetch() to backend                               │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────────┐
│                       MIDDLEWARE (Edge)                               │
│  middleware.ts                                                       │
│  ├── CORS headers para /api/*                                       │
│  ├── OPTIONS preflight handling                                     │
│  └── Auth redirect para /dashboard/*, /admin/*                      │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────────┐
│                         BACKEND (Next.js API Routes)                 │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    API Routes Layer                              │ │
│  │                                                                 │ │
│  │  /api/widget ──────────── Serve widget-core.js                  │ │
│  │  /api/images/generate ─── Sync generation (FAL)                 │ │
│  │  /api/images/upload ───── Pre-upload to FAL Storage             │ │
│  │  /api/jobs/submit ─────── Async generation (fire & forget)      │ │
│  │  /api/jobs/[id]/status ── Poll job status                       │ │
│  │  /api/jobs/health ─────── Redis health check                    │ │
│  │  /api/health ──────────── General health + warm-up              │ │
│  │  /api/metrics ─────────── Get metrics (admin/client)            │ │
│  │  /api/clients ─────────── CRUD companies                        │ │
│  │  /api/ingest ──────────── Ingest metric events                  │ │
│  │  /api/auth/login ──────── Admin login (cookie)                  │ │
│  │  /api/admin/analytics ─── Analytics data for charts             │ │
│  └────────────────────┬────────────────────────────────────────────┘ │
│                       │                                              │
│  ┌────────────────────┼────────────────────────────────────────────┐ │
│  │               Library Layer (lib/)                              │ │
│  │                                                                 │ │
│  │  auth.ts ─────────── API key validation (in-memory map)         │ │
│  │  fal-client.ts ───── FAL AI sync client                         │ │
│  │  fal-async.ts ────── FAL AI async processor                     │ │
│  │  metrics.ts ──────── Send events to external dashboard          │ │
│  │  metrics-store.ts ── In-memory metrics + file persistence       │ │
│  │  job-store.ts ────── Redis-backed job lifecycle                  │ │
│  │  redis.ts ────────── Upstash Redis singleton                    │ │
│  │  latency.ts ──────── Timing instrumentation                     │ │
│  │  http-agent.ts ───── HTTPS keep-alive agent                     │ │
│  │  cors.ts ─────────── CORS helper functions                      │ │
│  │  banana-client.ts ── Legacy Banana Pro client (stub)            │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │               Dashboard (React/Next.js Pages)                   │ │
│  │                                                                 │ │
│  │  /login ──────────── Login page                                 │ │
│  │  /dashboard ──────── Main dashboard (companies + metrics)       │ │
│  │  /dashboard/analytics ── Charts and analytics                   │ │
│  │  /admin ──────────── Redirect to /dashboard                     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      SERVICIOS EXTERNOS                              │
│                                                                      │
│  ┌─────────────────────┐  ┌──────────────────────┐                  │
│  │ FAL AI              │  │ Upstash Redis        │                  │
│  │ Modelo: nano-banana │  │ Job store            │                  │
│  │ -pro/edit           │  │ TTL: 1 hora          │                  │
│  │ Inference + CDN     │  │ REST API             │                  │
│  └─────────────────────┘  └──────────────────────┘                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Frontend - Widget

### Archivo: `lib/widget-core.js` (1507 líneas)

#### Estructura del código

```
IIFE (function() { ... })()
├── Configuración inicial
│   ├── getCurrentScript() → obtiene el <script> tag
│   ├── API_KEY ← data-tryon-key
│   ├── BACKEND_URL ← detectado del script.src
│   ├── LOADING_STATES[] ← secuencia de textos de loading
│   └── window.__TRYON_WIDGET_LOADED__ ← prevenir doble init
│
├── Estado del widget (objeto mutable)
│   ├── isOpen, isDragging
│   ├── userImage (base64 | null)
│   ├── garments[3] (base64 | null)
│   ├── resultImage, generationStatus
│   ├── inputsUsed, showOnboarding
│   └── currentLoadingState, loadingTimeout
│
├── Funciones de utilidad
│   ├── compressImage(file, maxSize=768, quality=0.7)
│   ├── optimizeForInference(base64, 768h × 512w, quality=0.75)
│   ├── fileToBase64(file)
│   └── createProgressUpdater() → {start, complete, cancel}
│
├── Secuencia de loading
│   ├── startLoadingSequence() → muestra textos animados
│   └── stopLoadingSequence() → fade out
│
├── Shadow DOM setup
│   ├── container = div#tryon-widget-root → document.body
│   ├── shadow = container.attachShadow({mode: 'open'})
│   ├── styles (CSS string, ~500 líneas)
│   └── html (template HTML)
│
├── Event listeners
│   ├── fab click → openWidget()
│   ├── close click → closeWidget()
│   ├── result close → resetToInitial()
│   ├── overlay click → closeWidget()
│   ├── submit click → async generation flow
│   ├── onboarding done → hide
│   ├── user image box click/drag/drop
│   ├── garment boxes click/drag/drop (×3)
│   └── result image mousemove → zoom 2x
│
└── Funciones principales
    ├── openWidget() / closeWidget()
    ├── updateSubmitButton()
    ├── setupGarmentBox(box, index)
    ├── handleUserImageUpload(file)
    ├── handleGarmentUpload(file, index)
    ├── uploadToFalStorage(base64) → URL
    └── resetToInitial()
```

#### Sistema de estado

El estado es un **objeto JavaScript plano** (no reactive):

```javascript
const state = {
  isOpen: false,              // Panel abierto/cerrado
  isDragging: false,          // Drag & drop activo
  userImage: null,            // base64 de la foto del usuario
  garments: [null, null, null], // base64 de hasta 3 prendas
  resultImage: null,          // URL del resultado
  isGenerating: false,        // (legacy, reemplazado por generationStatus)
  generationStatus: 'idle',   // 'idle' | 'processing' | 'completed' | 'error'
  inputsUsed: null,           // Inputs preservados post-generación
  showOnboarding: !localStorage.getItem('tryon_onboarding_done'),
  currentLoadingState: 0,     // Índice del estado de loading actual
  loadingTimeout: null,       // setTimeout ID para limpiar
};
```

Los cambios de estado se reflejan en el DOM manualmente (no hay binding reactivo):
- `updateSubmitButton()` → actualiza texto, clase y disabled del botón
- Manipulación directa del DOM: `element.style.display`, `element.classList.add/remove`, `element.innerHTML`

#### Manejo de archivos

1. **Click** en upload box → `input.click()` → selector de archivos nativo
2. **Drag & drop** → `dragover/dragleave/drop` event handlers
3. **Conversión**: `FileReader.readAsDataURL()` → base64 data URL
4. **Compresión**: Canvas resize a max 1080px, JPEG 85%
5. **Optimización pre-envío**: Resize a 768×512 proporcional, JPEG 75%

---

## Backend - Next.js API

### Estructura de carpetas

```
app/api/
├── widget/route.ts          → GET: Serve widget JS
├── images/
│   ├── generate/route.ts    → POST: Sync generation
│   └── upload/route.ts      → POST: Pre-upload to FAL
├── jobs/
│   ├── submit/route.ts      → POST: Async job submission
│   ├── [id]/status/route.ts → GET: Poll job status
│   └── health/route.ts      → GET: Redis health check
├── health/route.ts           → GET: General health
├── metrics/route.ts          → GET: Get metrics
├── clients/route.ts          → GET/POST/DELETE: CRUD companies
├── ingest/route.ts           → POST: Ingest events
├── auth/login/route.ts       → POST/DELETE: Login/logout
└── admin/analytics/route.ts  → GET: Analytics data
```

### Endpoints detallados

#### `GET /api/widget`
- **Qué hace**: Lee `lib/widget-core.js` del filesystem y lo devuelve como JavaScript.
- **Content-Type**: `application/javascript; charset=utf-8`
- **Cache**: `no-cache, no-store, must-revalidate`
- **CORS**: `Access-Control-Allow-Origin: *`
- **Lógica**: `readFileSync(widgetPath, 'utf-8')` → response

#### `POST /api/images/generate`
- **Config**: `maxDuration = 60`, `dynamic = 'force-dynamic'`
- **Flujo**:
  1. Parse body JSON
  2. Detectar cold start (>5 min sin requests)
  3. Log timing inicial
  4. Validar campos (`apiKey`, `userImage|userImageUrl`, `garments|garmentUrls`)
  5. Validar API key → `validateApiKey()`
  6. Llamar a FAL AI → `generateWithFal()`
  7. Registrar métrica → `recordEvent()`
  8. Devolver resultado con timings
- **Soporta tanto base64 como URLs** (backward compatible)
- **Cold start detection**: Variable global `lastRequestTime`, threshold 5 min

#### `POST /api/images/upload`
- **Qué hace**: Pre-sube una imagen a FAL Storage CDN
- **Flujo**:
  1. Parse body (`apiKey`, `image` base64)
  2. Validar API key
  3. Convertir base64 → Buffer → Blob → File
  4. `fal.storage.upload(file)` → URL
  5. Devolver URL
- **Beneficio**: FAL accede a su CDN ~1-2s más rápido que decodificar base64

#### `POST /api/jobs/submit`
- **Qué hace**: Crea un job asíncrono y responde inmediatamente
- **Flujo**:
  1. Verificar Redis configurado
  2. Parse y validar body
  3. Generar `job_id`
  4. Crear job en Redis (status: `queued`)
  5. **Fire & forget**: `processJobAsync()` sin `await`
  6. Responder con `job_id` y `poll_url`
- **Tiempo de respuesta**: <300ms

#### `GET /api/jobs/[id]/status`
- **Qué hace**: Devuelve el estado actual de un job
- **Response**: `{ status, image_url, error, timestamps }`
- **Cache**: `no-store` por defecto, `max-age=60` si done/error

#### `GET /api/health`
- **Propósito**: Warm-up de serverless, evitar cold starts
- **Checks**: uptime, memory, FAL configured, node version, HTTP agent
- **También inicializa**: FAL client config, HTTP agent
- **Soporta HEAD** para pings más ligeros

---

## Middleware

### Archivo: `middleware.ts`

El middleware de Next.js se ejecuta en el Edge Runtime antes de cada request:

```typescript
export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/api/:path*'],
};
```

### Funciones:

1. **CORS para APIs** (`/api/*`):
   - Agrega headers CORS a todas las responses
   - Maneja preflight OPTIONS con 204

2. **Auth para Dashboard** (`/dashboard/*`, `/admin/*`):
   - Verifica cookie `admin_auth = 'authenticated'`
   - Si no hay cookie → redirect a `/login?redirect={path}`
   - `/login` está excluido de la protección

### CORS Headers aplicados:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, x-client-key, x-admin-key
Access-Control-Max-Age: 86400
Content-Security-Policy: (permisiva para widget)
```

---

## Librerías Compartidas

### `lib/auth.ts` - Autenticación

```typescript
// Mapeo estático de API keys a clientes
const CLIENTS: Record<string, ClientInfo> = {
  'demo_key_12345': { id: 'client_001', name: 'Demo Company', ... },
  'demotryon01':    { id: 'client_002', name: 'Demo TryOn', ... },
  'testtryon01':    { id: 'client_003', name: 'Test TryOn', ... },
};

function validateApiKey(apiKey: string): ClientInfo | null
function getClientByApiKey(apiKey: string): ClientInfo | null
```

> **Limitación**: Los clientes están hardcoded. Nuevos clientes creados via `/api/clients` solo se registran en `metrics-store.ts` (en memoria), NO en `auth.ts`. Esto significa que los clientes creados dinámicamente no pueden autenticarse en `/api/images/generate`.

### `lib/fal-client.ts` - Cliente FAL AI (Síncrono)

- **Modelo**: `fal-ai/nano-banana-pro/edit`
- **Input**: `person_image` + `garment_image` (una prenda a la vez)
- **Procesamiento serial**: Si hay múltiples garments, se procesan secuencialmente, usando el resultado anterior como input
- **Timings**: Instrumentación completa con `latency.ts`
- **Error handling**: Logs detallados del error FAL

### `lib/fal-async.ts` - Procesador Asíncrono

- Mismo modelo que fal-client.ts
- Usa `prompt` + `image_urls[]` en vez de `person_image/garment_image`
- **Discrepancia**: El procesador async usa un prompt textual para describir qué hacer, mientras que el sync usa campos estructurados. Esto puede producir resultados diferentes.

### `lib/metrics-store.ts` - Store de Métricas

- **In-memory**: `Map<string, MetricEvent[]>`
- **Persistencia**: Escribe a `temp/metrics.json` en cada evento
- **Carga al iniciar**: Lee `temp/metrics.json` si existe
- **Clientes registrados**: Otro `Map` hardcoded con clientes iniciales
- **Límite**: 1000 eventos por cliente (FIFO)
- **Funciones analytics**: `getTimeSeriesData()`, `getHourlyDistribution()`, `getRanking()`, `getDistribution()`

### `lib/job-store.ts` - Store de Jobs

- **Backend**: Upstash Redis
- **TTL**: 1 hora (auto-cleanup)
- **Prefijo**: `job:`
- **Ciclo de vida**: `queued → processing → done|error`
- **Timestamps**: `created_at`, `fal_start`, `fal_end`, `completed_at`

### `lib/redis.ts` - Cliente Redis

- **Singleton**: Inicialización lazy
- **Variables**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- **Serverless-friendly**: Upstash REST API (no TCP)

### `lib/latency.ts` - Instrumentación

- `createTimingContext()` → ID + start time
- `logLatency()` → JSON structurado a console
- `measureAsync()` → wrapper que mide duración de funciones async
- `calculateTimings()` → resumen de request completo

### `lib/http-agent.ts` - HTTP Agent

- HTTPS Agent con `keepAlive: true`
- maxSockets: 50, maxFreeSockets: 10
- timeout: 60s
- Beneficio limitado en serverless, útil durante ráfagas

### `lib/cors.ts` - Helpers CORS

- `CORS_HEADERS` → objeto con headers
- `corsResponse()` → Response con CORS + JSON
- `corsOptions()` → 204 con solo CORS headers

### `lib/banana-client.ts` - Cliente Legacy

- **No implementado** (stub/simulación)
- Devuelve la imagen del usuario sin modificar después de 2s delay
- Existe como placeholder para un proveedor alternativo

---

## Deployment

### Configuración Next.js (`next.config.js`)

```javascript
{
  reactStrictMode: true,
  poweredByHeader: false,
  headers: [
    // Headers CORS globales
    // Cache 1h para /api/widget
    // CORS para /api/images/generate
  ]
}
```

### Configuración Vercel (`vercel.json`)

```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "x-vercel-protection-bypass", "value": "true" }
      ]
    }
  ]
}
```

El `x-vercel-protection-bypass` desactiva la protección de deployment de Vercel para los endpoints API, permitiendo acceso directo sin autenticación de Vercel.

### Edge vs Serverless

| Endpoint | Runtime | Razón |
|---|---|---|
| `/api/widget` | Node.js (Serverless) | Usa `readFileSync` (no disponible en Edge) |
| `/api/images/generate` | Node.js, maxDuration=60 | Llamadas FAL de larga duración |
| `/api/images/upload` | Node.js | Similar a generate |
| `/api/jobs/*` | Node.js | Acceso a Redis |
| `/api/health` | Node.js | Acceso a `process.memoryUsage()` |
| `middleware.ts` | Edge | Rápido, solo CORS + auth check |

---

> **Referencias cruzadas**: Ver [API_REFERENCE.md](API_REFERENCE.md) para detalle de cada endpoint, [DATABASE_AND_STORAGE.md](DATABASE_AND_STORAGE.md) para la capa de persistencia, y [AI_INTEGRATION.md](AI_INTEGRATION.md) para los clientes de FAL.
