# MIGRATION GUIDE - Guía de Migración y Evolución

## Tabla de Contenidos

- [Motivación](#motivación)
- [Estado actual vs estado deseado](#estado-actual-vs-estado-deseado)
- [Fase 1: Persistencia de datos](#fase-1-persistencia-de-datos)
- [Fase 2: Autenticación robusta](#fase-2-autenticación-robusta)
- [Fase 3: Multi-modelo y cache](#fase-3-multi-modelo-y-cache)
- [Fase 4: Escalabilidad](#fase-4-escalabilidad)
- [Fase 5: Observabilidad](#fase-5-observabilidad)
- [Diagrama de arquitectura mejorada](#diagrama-de-arquitectura-mejorada)
- [Riesgos y mitigaciones](#riesgos-y-mitigaciones)
- [Estimación de esfuerzo](#estimación-de-esfuerzo)

---

## Motivación

El sistema actual funciona como MVP pero tiene limitaciones que impiden su uso en producción a escala:

| Problema | Impacto | Urgencia |
|---|---|---|
| Datos en memoria (se pierden en redeploy) | Pérdida de métricas y empresas | Alta |
| API keys hardcodeadas | No se pueden rotar, no escala | Alta |
| Sin rate limiting | Riesgo de abuso y costos | Alta |
| CORS `*` abierto | Cualquier sitio puede usar la API | Media |
| Sin tests automatizados | Riesgo en cambios | Media |
| Un solo modelo de IA | Sin fallback ante caída de FAL | Media |
| Sin CDN para resultados | Imágenes dependen de FAL | Baja |

---

## Estado Actual vs Estado Deseado

| Aspecto | Actual | Deseado |
|---|---|---|
| **Base de datos** | Memoria + temp/metrics.json | PostgreSQL/Supabase |
| **Autenticación** | Hardcoded + cookie simple | JWT + OAuth + rotación de keys |
| **Rate limiting** | Ninguno | @upstash/ratelimit por tier |
| **CORS** | `*` | Lista blanca por cliente |
| **Cache** | Ninguno | Redis cache de resultados |
| **Modelo IA** | Solo FAL + 1 modelo | Multi-modelo con fallback |
| **Métricas** | In-memory Map | External (Posthog/Mixpanel) |
| **Testing** | Manual | Vitest + Playwright |
| **CI/CD** | Solo Vercel deploy | GitHub Actions pipeline |
| **Monitoreo** | Logs manuales | Sentry + structured logging |
| **Widget** | Vanilla JS monolítico | Modularizado o Preact |

---

## Fase 1: Persistencia de Datos

**Duración estimada**: 3-5 días
**Prioridad**: CRÍTICA

### 1.1 Elegir base de datos

| Opción | Pros | Cons | Costo |
|---|---|---|---|
| **Supabase** (PostgreSQL) | Gratis hasta 500MB, SDK simple, auth incluido | Requiere migración de schema | $0-25/mes |
| **PlanetScale** (MySQL) | Serverless, branching de schema | Sin tier gratis actualizado | $29/mes |
| **Vercel Storage** (Postgres) | Integración nativa con Vercel | Almacenamiento limitado | $0-20/mes |
| **MongoDB Atlas** | Flexible, JSON nativo | Overkill para este caso | $0-57/mes |

**Recomendación**: Supabase (PostgreSQL) — integración simple, auth incluido, tier gratis generoso.

### 1.2 Schema propuesto (PostgreSQL)

```sql
-- Empresas/Clientes
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  website VARCHAR(500),
  api_key VARCHAR(64) UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  tier VARCHAR(50) DEFAULT 'free', -- free, basic, pro, enterprise
  rate_limit INTEGER DEFAULT 10, -- requests/min
  allowed_origins TEXT[], -- CORS whitelist
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Eventos de métricas
CREATE TABLE metric_events (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB DEFAULT '{}',
  timestamp TIMESTAMP DEFAULT NOW(),
  INDEX idx_company_timestamp (company_id, timestamp)
);

-- Generaciones
CREATE TABLE generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  job_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, done, error
  garment_count INTEGER DEFAULT 1,
  result_image_url TEXT,
  error_message TEXT,
  duration_ms INTEGER,
  fal_duration_ms INTEGER,
  cold_start BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Sesiones admin
CREATE TABLE admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 1.3 Migración de `lib/auth.ts`

**Antes:**
```typescript
const clients: Record<string, ClientConfig> = {
  'demo_key_12345': { clientId: 'demo_client', company: 'Demo Client' },
};
```

**Después:**
```typescript
import { supabase } from './supabase';

export async function validateApiKey(apiKey: string): Promise<ClientConfig | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, active, tier, rate_limit, allowed_origins')
    .eq('api_key', apiKey)
    .eq('active', true)
    .single();

  if (error || !data) return null;

  return {
    clientId: data.id,
    company: data.name,
    tier: data.tier,
    rateLimit: data.rate_limit,
    allowedOrigins: data.allowed_origins,
  };
}
```

### 1.4 Migración de `lib/metrics-store.ts`

**Antes:** `Map<string, MetricEvent[]>` en memoria.

**Después:**
```typescript
export async function recordEvent(companyId: string, event: MetricEvent) {
  await supabase.from('metric_events').insert({
    company_id: companyId,
    event_type: event.type,
    event_data: event.data,
    timestamp: event.timestamp,
  });
}

export async function getTimeSeriesData(period: string, clientId: string) {
  const { data } = await supabase.rpc('get_time_series', {
    p_period: period,
    p_client_id: clientId === 'all' ? null : clientId,
  });
  return data;
}
```

---

## Fase 2: Autenticación Robusta

**Duración estimada**: 2-3 días
**Prioridad**: ALTA

### 2.1 JWT para sesiones admin

```typescript
// lib/jwt.ts
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export function createToken(payload: { userId: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): { userId: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}
```

### 2.2 Rate limiting por tier

```typescript
// lib/ratelimit.ts
import { Ratelimit } from '@upstash/ratelimit';

const rateLimits: Record<string, Ratelimit> = {
  free: new Ratelimit({
    redis, limiter: Ratelimit.slidingWindow(5, '60 s'),
  }),
  basic: new Ratelimit({
    redis, limiter: Ratelimit.slidingWindow(20, '60 s'),
  }),
  pro: new Ratelimit({
    redis, limiter: Ratelimit.slidingWindow(60, '60 s'),
  }),
  enterprise: new Ratelimit({
    redis, limiter: Ratelimit.slidingWindow(200, '60 s'),
  }),
};

export function getRateLimiter(tier: string): Ratelimit {
  return rateLimits[tier] || rateLimits.free;
}
```

### 2.3 CORS dinámico por cliente

```typescript
// middleware.ts actualizado
const client = await validateApiKey(apiKey);
if (client?.allowedOrigins?.length) {
  const origin = request.headers.get('origin');
  if (client.allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
} else {
  response.headers.set('Access-Control-Allow-Origin', '*');
}
```

---

## Fase 3: Multi-Modelo y Cache

**Duración estimada**: 3-4 días
**Prioridad**: MEDIA

### 3.1 Abstracción de proveedores de IA

```typescript
// lib/ai/types.ts
interface AIProvider {
  name: string;
  generate(input: TryOnInput): Promise<TryOnResult>;
  healthCheck(): Promise<boolean>;
}

// lib/ai/fal-provider.ts
class FalProvider implements AIProvider {
  name = 'fal';
  async generate(input: TryOnInput): Promise<TryOnResult> { ... }
  async healthCheck(): Promise<boolean> { ... }
}

// lib/ai/replicate-provider.ts
class ReplicateProvider implements AIProvider {
  name = 'replicate';
  async generate(input: TryOnInput): Promise<TryOnResult> { ... }
  async healthCheck(): Promise<boolean> { ... }
}

// lib/ai/router.ts
class AIRouter {
  private providers: AIProvider[];

  async generate(input: TryOnInput): Promise<TryOnResult> {
    for (const provider of this.providers) {
      try {
        if (await provider.healthCheck()) {
          return await provider.generate(input);
        }
      } catch (error) {
        console.warn(`${provider.name} failed, trying next...`);
      }
    }
    throw new Error('All AI providers failed');
  }
}
```

### 3.2 Cache de resultados

```typescript
// lib/cache.ts
import { Redis } from '@upstash/redis';

// Hash de inputs para cache key
function hashInputs(userImage: string, garments: string[]): string {
  const crypto = require('crypto');
  const input = JSON.stringify({ userImage, garments });
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function getCachedResult(inputHash: string): Promise<string | null> {
  return await redis.get(`cache:result:${inputHash}`);
}

export async function setCachedResult(inputHash: string, resultUrl: string) {
  await redis.set(`cache:result:${inputHash}`, resultUrl, { ex: 86400 }); // 24h TTL
}
```

### 3.3 CDN propio para resultados

Actualmente las imágenes resultado viven en FAL CDN (`fal.media`). Para mayor control:

```typescript
// Opción: Cloudflare R2 (S3-compatible, sin egress fees)
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY!,
    secretAccessKey: process.env.R2_SECRET_KEY!,
  },
});

async function persistResult(falUrl: string, jobId: string): Promise<string> {
  const image = await fetch(falUrl);
  const buffer = await image.arrayBuffer();

  await r2.send(new PutObjectCommand({
    Bucket: 'tryon-results',
    Key: `results/${jobId}.png`,
    Body: new Uint8Array(buffer),
    ContentType: 'image/png',
  }));

  return `https://cdn.tu-dominio.com/results/${jobId}.png`;
}
```

---

## Fase 4: Escalabilidad

**Duración estimada**: 3-5 días
**Prioridad**: MEDIA-BAJA

### 4.1 Cola de jobs con Bull/BullMQ

Reemplazar el fire-and-forget actual con una cola robusta:

```typescript
// lib/queue.ts
import { Queue, Worker } from 'bullmq';

const connection = { host: 'redis-host', port: 6379 };

export const generationQueue = new Queue('generations', { connection });

// Worker (puede correr en proceso separado)
const worker = new Worker('generations', async (job) => {
  const { personImage, garmentImages, jobId } = job.data;
  const result = await aiRouter.generate({ personImage, garmentImages });
  await markJobDone(jobId, result.imageUrl);
}, {
  connection,
  concurrency: 3, // Procesar 3 jobs en paralelo
});
```

### 4.2 WebSockets para notificaciones

Reemplazar polling HTTP con notificaciones en tiempo real:

```typescript
// Con Pusher o Ably (serverless-compatible)
import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: 'us2',
});

// Cuando el job termina:
await pusher.trigger(`job-${jobId}`, 'completed', {
  imageUrl: resultImageUrl,
});
```

### 4.3 Widget como paquete NPM

Convertir `widget-core.js` en un paquete publicable:

```
tryon-widget/
├── src/
│   ├── index.ts
│   ├── components/
│   │   ├── FAB.ts
│   │   ├── Panel.ts
│   │   ├── UploadBox.ts
│   │   ├── ResultView.ts
│   │   └── LoadingSequence.ts
│   ├── services/
│   │   ├── api.ts
│   │   └── image-processor.ts
│   ├── styles/
│   │   └── theme.ts
│   └── types.ts
├── package.json
├── tsconfig.json
├── rollup.config.js  # Bundle a IIFE
└── README.md
```

---

## Fase 5: Observabilidad

**Duración estimada**: 2-3 días
**Prioridad**: MEDIA

### 5.1 Error tracking con Sentry

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
```

### 5.2 Structured logging

```typescript
// lib/logger.ts
interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  requestId?: string;
  clientId?: string;
  duration_ms?: number;
  [key: string]: any;
}

export function log(entry: LogEntry) {
  console.log(JSON.stringify({
    ...entry,
    timestamp: new Date().toISOString(),
    service: 'tryon-backend',
  }));
}
```

### 5.3 Analytics externo

```typescript
// Reemplazar MetricsStore con PostHog o Mixpanel
import { PostHog } from 'posthog-node';

const posthog = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: 'https://app.posthog.com',
});

export function trackEvent(clientId: string, event: string, properties: Record<string, any>) {
  posthog.capture({
    distinctId: clientId,
    event,
    properties,
  });
}
```

---

## Diagrama de Arquitectura Mejorada

```
┌─────────────────────────────────────────────────────────┐
│                    ARQUITECTURA v2.0                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐    ┌───────────────────┐   ┌───────────┐ │
│  │  Widget   │───▶│   API Gateway     │──▶│ Rate      │ │
│  │  (NPM)   │    │   (Middleware)     │   │ Limiter   │ │
│  └──────────┘    └───────┬───────────┘   │ (Upstash) │ │
│                          │               └───────────┘ │
│                          ▼                              │
│  ┌───────────────────────────────────────────────┐     │
│  │              API Routes (Next.js)              │     │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────┐  │     │
│  │  │ Generate │ │  Upload  │ │ Jobs (Queue)  │  │     │
│  │  └─────┬────┘ └─────┬────┘ └───────┬───────┘  │     │
│  └────────┼─────────────┼─────────────┼──────────┘     │
│           │             │             │                 │
│           ▼             ▼             ▼                 │
│  ┌──────────────────────────────────────────────┐      │
│  │              AI Router (Fallback)             │      │
│  │  ┌────────┐  ┌───────────┐  ┌─────────────┐  │      │
│  │  │  FAL   │  │ Replicate │  │   RunPod    │  │      │
│  │  │Primary │  │ Fallback  │  │   Backup    │  │      │
│  │  └────────┘  └───────────┘  └─────────────┘  │      │
│  └──────────────────────────────────────────────┘      │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │PostgreSQL│  │  Redis   │  │ R2 CDN   │  │ Sentry │ │
│  │(Supabase)│  │(Upstash) │  │(Cloudfl.)│  │        │ │
│  │Companies │  │Cache+Jobs│  │ Images   │  │ Errors │ │
│  │Metrics   │  │RateLimit │  │          │  │ Traces │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Downtime durante migración de DB | Media | Alto | Feature flags, migración gradual |
| Incompatibilidad de API keys | Alta | Alto | Periodo de transición con ambos sistemas |
| Aumento de latencia por DB queries | Media | Medio | Cache agresivo en Redis |
| Rotura de widget en clientes | Baja | Alto | Versionado de widget, backward compat |
| Costos de nueva infraestructura | Baja | Bajo | Usar tiers gratuitos inicialmente |
| Curva de aprendizaje del equipo | Media | Medio | Documentación, pair programming |

---

## Estimación de Esfuerzo

| Fase | Duración | Desarrolladores | Dependencias |
|---|---|---|---|
| Fase 1: Persistencia | 3-5 días | 1 | Cuenta Supabase |
| Fase 2: Auth robusta | 2-3 días | 1 | Fase 1 completada |
| Fase 3: Multi-modelo | 3-4 días | 1 | Cuentas en proveedores |
| Fase 4: Escalabilidad | 3-5 días | 1-2 | Fases 1-3 completadas |
| Fase 5: Observabilidad | 2-3 días | 1 | Cuenta Sentry |
| **Total** | **13-20 días** | **1-2** | - |

### Orden recomendado de ejecución

```
Semana 1: Fase 1 (DB) + Inicio Fase 2 (Auth)
Semana 2: Completar Fase 2 + Fase 5 (Observabilidad)
Semana 3: Fase 3 (Multi-modelo)
Semana 4: Fase 4 (Escalabilidad)
```

> **Nota**: Las fases pueden ejecutarse en paralelo por diferentes desarrolladores, excepto Fase 2 que depende de Fase 1.

---

> **Referencias**: Ver [ARCHITECTURE.md](ARCHITECTURE.md) para la arquitectura actual, [DATABASE_AND_STORAGE.md](DATABASE_AND_STORAGE.md) para las estructuras de datos actuales, y [FUTURE_ROADMAP.md](FUTURE_ROADMAP.md) para el roadmap de producto.
