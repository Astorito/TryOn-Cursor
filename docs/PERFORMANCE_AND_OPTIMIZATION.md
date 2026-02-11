# PERFORMANCE AND OPTIMIZATION - Velocidad y Optimización

## Tabla de Contenidos

- [Análisis de latencia actual](#análisis-de-latencia-actual)
- [Bottlenecks identificados](#bottlenecks-identificados)
- [Optimizaciones implementadas](#optimizaciones-implementadas)
- [Optimizaciones pendientes](#optimizaciones-pendientes)
- [Métricas de performance](#métricas-de-performance)
- [Targets de performance](#targets-de-performance)

---

## Análisis de Latencia Actual

### Desglose del tiempo E2E (end-to-end)

```
Tiempo total ≈ 8-15 segundos

┌──────────┬────────────┬──────────────────────────┬───────────┬─────────┐
│ FE Prep  │ Network Up │      FAL Inference       │Network Dn │FE Render│
│ ~200ms   │  ~100ms    │      ~5000-8000ms        │  ~100ms   │ ~50ms   │
└──────────┴────────────┴──────────────────────────┴───────────┴─────────┘
   │              │                  │                   │          │
   │              │                  │                   │          └─ Mostrar imagen
   │              │                  │                   └─ Descargar response JSON
   │              │                  └─ Modelo de IA procesando
   │              └─ Enviar request al backend
   └─ Comprimir + optimizar imágenes en el navegador
```

### Frontend

| Fase | Duración Típica | Qué hace |
|---|---|---|
| Image compression | ~100ms | Canvas resize a 1080px, JPEG 85% |
| Image optimization | ~100ms | Canvas resize a 768px, JPEG 75% |
| Network upload | ~50-200ms | POST JSON con base64 al backend |
| Render result | ~50ms | Mostrar imagen en el DOM |

### Backend

| Fase | Duración Típica | Qué hace |
|---|---|---|
| Body parsing | ~5-20ms | `request.json()` |
| Auth validation | <1ms | Lookup en objeto hardcoded |
| Pre-processing | ~1-5ms | Validaciones, logging |
| **FAL API call** | **~5000-8000ms** | **Inference del modelo de IA** |
| Post-processing | ~1-5ms | Formatear response, registrar métrica |
| **Total backend** | **~5100-8100ms** | |

### Network

| Fase | Duración Típica | Factores |
|---|---|---|
| Upload (client→Vercel) | ~50-200ms | Tamaño del base64, distancia a CDN |
| Download (Vercel→client) | ~50-100ms | Response JSON con URL (pequeño) |
| Vercel→FAL | ~20-50ms | Internas, redes de datacenter |

---

## Bottlenecks Identificados

### 1. FAL Inference (~5-8s) — **NO controlable**

- **Problema**: El modelo de IA tarda 5-8 segundos en generar la imagen.
- **Causa**: Es el tiempo de inferencia del modelo `nano-banana-pro/edit`.
- **Solución**: No se puede acelerar desde nuestro lado. Solo FAL puede optimizar su modelo.
- **Mitigación**: Usar UI de loading para que la espera sea tolerable.

### 2. Base64 Encoding (~100-300ms extra payload)

- **Problema**: Las imágenes se envían como base64 en JSON, aumentando el payload ~33%.
- **Tamaño típico**: Imagen comprimida ~100-300KB en base64.
- **Solución implementada**: Pre-upload a FAL Storage (reduce payload y latencia de FAL).
- **Solución pendiente**: Siempre usar URLs en vez de base64.

### 3. Cold Starts en Vercel (~800-2000ms)

- **Problema**: Si la función serverless no se ha ejecutado en >5 min, Vercel necesita arrancarla.
- **Causa**: Lifecycle de serverless — cold start incluye inicializar Node.js, cargar módulos, etc.
- **Solución implementada**: Endpoint `/api/health` para warm-up con cron o UptimeRobot.
- **Detección**: Variable global `lastRequestTime` con threshold de 5 min.

### 4. Sin Caché de Resultados

- **Problema**: Si un usuario genera la misma combinación persona+prenda, se procesa de nuevo.
- **Impacto**: Cada generación cuesta dinero (FAL billing) y tiempo.
- **Solución pendiente**: Hash de inputs → cache de resultado en Redis.

### 5. Procesamiento Serial de Múltiples Prendas

- **Problema**: Si el usuario sube 3 prendas, se hacen 3 llamadas secuenciales a FAL.
- **Impacto**: 3 prendas × ~6s = ~18s de espera.
- **Causa**: El modelo procesa una prenda a la vez, usando el resultado anterior como input.
- **Solución potencial**: Buscar modelo que soporte múltiples garments en una sola llamada.

---

## Optimizaciones Implementadas

### 1. Pre-upload a FAL Storage

```
SIN pre-upload:
  Widget → base64 en JSON → Backend → FAL (decodifica base64) → Resultado
  
CON pre-upload:
  Widget → base64 → Backend/upload → FAL Storage (URL)
  Widget → URL en JSON → Backend → FAL (accede a su CDN) → Resultado
```

- **Reducción**: ~1-2 segundos menos en FAL inference.
- **Endpoint**: `POST /api/images/upload`
- **Implementación**: `fal.storage.upload(file)` devuelve URL del CDN de FAL.

> **Nota**: El widget tiene la función `uploadToFalStorage()` pero actualmente el flujo principal **NO la usa** automáticamente. Se envía base64 directo.

### 2. Sistema Async con Jobs

- **Problema**: Requests HTTP de 15+ segundos pueden causar timeouts.
- **Solución**: `POST /api/jobs/submit` responde en <300ms con `job_id`, procesa en background.
- **Polling**: `GET /api/jobs/{id}/status` cada 2 segundos.
- **Almacenamiento**: Redis (Upstash) con TTL de 1 hora.

### 3. HTTP Keep-Alive Agent

```typescript
// lib/http-agent.ts
const agent = new Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
});
```

- **Beneficio**: Reutilizar conexiones TCP/TLS (~100-300ms ahorrados por conexión nueva).
- **Limitación**: En serverless cada instancia puede ser diferente.
- **Útil**: Durante ráfagas de requests (misma instancia de lambda).

### 4. Health Endpoint para Warm-up

```
GET /api/health
```

- Inicializa FAL client, HTTP agent.
- Devuelve uptime, memory, config checks.
- Soporta HEAD para pings más ligeros.
- **Uso**: UptimeRobot o Vercel Cron cada 5 min para mantener caliente.

### 5. Compresión de Imágenes en Frontend

```javascript
// Paso 1: Compresión al subir (1080px, JPEG 85%)
const compressed = await compressImage(base64);

// Paso 2: Optimización pre-envío (768px, JPEG 75%)
const optimized = await optimizeForInference(state.userImage);
```

- **Reducción típica**: 60-80% del tamaño original.
- **Resolución output**: 768px altura max, 512*1.5=768px ancho max.
- **Quality**: JPEG 75% — suficiente para IA, reduce payload significativamente.

### 6. Cold Start Detection

```typescript
let lastRequestTime = 0;
let requestCount = 0;

function detectColdStart() {
  const now = Date.now();
  const timeSinceLastMs = lastRequestTime === 0 ? 0 : now - lastRequestTime;
  const isCold = lastRequestTime === 0 || timeSinceLastMs > 300000; // 5 min
  lastRequestTime = now;
  requestCount++;
  return { isCold, timeSinceLastMs };
}
```

Se incluye en los timings para correlacionar latencia alta con cold starts.

---

## Optimizaciones Pendientes

### Alta Prioridad

| Optimización | Ahorro Estimado | Esfuerzo | Cómo |
|---|---|---|---|
| Siempre usar URLs (no base64) | ~1-3s | Medio | Pre-upload obligatorio, enviar URLs |
| Caché de resultados | Ahorra calls a FAL | Medio | Hash(inputs) → Redis → resultado |
| WebP en vez de JPEG | ~30% menos tamaño | Bajo | Cambiar `canvas.toDataURL('image/webp', 0.8)` |
| Resize en frontend | ~50% menos payload | Bajo | Ya implementado parcialmente, forzar siempre |

### Media Prioridad

| Optimización | Ahorro Estimado | Esfuerzo | Cómo |
|---|---|---|---|
| CDN para imágenes resultado | Menor latencia render | Medio | Guardar resultado en S3/CloudFront |
| Lazy loading del widget | Menor TTI del host | Bajo | Cargar widget con `defer` + `IntersectionObserver` |
| Connection prewarming | ~200ms | Bajo | `<link rel="preconnect" href="https://...">` |
| Compresión gzip/brotli | ~50% menos transfer | Bajo | Vercel lo hace automáticamente para JS |

### Baja Prioridad

| Optimización | Ahorro Estimado | Esfuerzo | Cómo |
|---|---|---|---|
| Service Worker | Offline support | Alto | Cachear widget y assets estáticos |
| Streaming response (SSE) | Percepción más rápida | Alto | Server-Sent Events para progress real |
| Multi-región | Menor network latency | Alto | Replicar en múltiples regiones de Vercel |

---

## Métricas de Performance

### Cómo se miden

El sistema usa `performance.now()` para medir tiempos con precisión sub-milisegundo:

```typescript
// lib/latency.ts
function logLatency(log: LatencyLog): void {
  console.log(JSON.stringify({
    level: 'info',
    type: 'latency',
    requestId: log.requestId,
    phase: log.phase,           // "be_request_received", "be_fal_request_sent", etc.
    durationMs: log.durationMs,
    timestamp: log.timestamp,
    metadata: log.metadata,
  }));
}
```

### Fases instrumentadas (Backend)

| Fase | Variable | Descripción |
|---|---|---|
| `be_request_received` | t=0 | Request llega al handler |
| `be_body_parsed` | t1 | JSON body parseado |
| `be_auth_done` | t2 | API key validada |
| `be_fal_request_sent` | t3 | Inicio de llamada a FAL |
| `be_fal_response_received` | t4 | FAL devolvió resultado |
| `be_response_sent` | t5 | Response enviado al cliente |

### Fases instrumentadas (Frontend Widget)

El widget emite logs `[TryOn Timing]` con:

| Fase | Descripción |
|---|---|
| `click` | Usuario clickeó "Try Look" |
| `preupload_end` | Pre-upload completado |
| `request_sent` | Fetch enviado al backend |
| `response_received` | Respuesta recibida |
| `render_done` | Imagen mostrada al usuario |
| `e2e_complete` | Flujo completo terminado |

### Script de análisis

```bash
# scripts/analyze-latency.ts
# Analiza logs JSON y genera reporte

cat vercel-logs.json | npx ts-node scripts/analyze-latency.ts
```

**Output del script:**

```
═══════════════════════════════════════════════════════
                    LATENCY ANALYSIS REPORT
═══════════════════════════════════════════════════════

Total requests analyzed: 50

┌─────────────────────────┬───────┬───────┬───────┬───────┬───────┐
│ Metric                  │ Count │  Avg  │  P50  │  P95  │StdDev │
├─────────────────────────┼───────┼───────┼───────┼───────┼───────┤
│ FE Pre-upload           │    50 │   180 │   150 │   350 │    80 │
│ BE → FAL Inference      │    50 │  6200 │  5800 │  8500 │  1200 │
│ BE Overhead             │    50 │    35 │    25 │    80 │    20 │
│ TOTAL E2E               │    50 │  7500 │  7000 │ 10000 │  1500 │
└─────────────────────────┴───────┴───────┴───────┴───────┴───────┘

RECOMMENDED ACTIONS:
  ℹ️ FAL inference es consistente (6200ms) - tiempo de modelo
  ⚡ IMPLEMENT SERVERLESS WARMUP: Cold=9500ms vs Warm=7000ms
```

---

## Targets de Performance

| Métrica | Actual | Target Ideal | Target Aceptable | Notas |
|---|---|---|---|---|
| **E2E total** | 8-15s | <5s | <10s | FAL limita el mínimo teórico |
| **FAL inference** | 5-8s | N/A | N/A | No controlable |
| **Backend overhead** | 20-80ms | <50ms | <100ms | Auth + parsing + logging |
| **Frontend prep** | 100-300ms | <100ms | <200ms | Compresión + optimización |
| **Network roundtrip** | 100-400ms | <100ms | <200ms | CDN de Vercel ayuda |
| **Cold start** | 800-2000ms | 0ms | <500ms | Warm-up resuelve parcialmente |
| **Submit response** (async) | <300ms | <100ms | <300ms | Ya cumple target |
| **Widget load** | ~50KB | <30KB | <50KB | Minificación pendiente |

### Fórmula ideal

```
E2E_ideal = frontend_prep + network_up + backend_overhead + FAL_inference + network_down + render
E2E_ideal = 100ms + 50ms + 30ms + 5000ms + 50ms + 50ms = 5280ms ≈ 5.3s
```

El **mínimo teórico** está limitado por FAL inference (~5s). Todo lo demás está bajo nuestro control.

---

> **Referencias**: Ver [AI_INTEGRATION.md](AI_INTEGRATION.md) para detalles sobre los tiempos de FAL, y [TESTING.md](TESTING.md) para scripts de análisis de performance.
