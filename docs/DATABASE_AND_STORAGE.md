# DATABASE AND STORAGE - Persistencia de Datos

## Tabla de Contenidos

- [Filosofía actual](#filosofía-actual)
- [Dónde se guarda la información](#dónde-se-guarda-la-información)
- [Estructura de datos](#estructura-de-datos)
- [Por qué no hay DB](#por-qué-no-hay-db)
- [Cómo agregar DB en el futuro](#cómo-agregar-db-en-el-futuro)

---

## Filosofía Actual

El proyecto sigue una filosofía **"sin base de datos persistente"** por diseño:

- **Simplicidad**: No hay que gestionar migraciones, backups, o esquemas.
- **Velocidad de desarrollo**: Se puede iterar sin preocuparse por el esquema.
- **Costo cero**: No hay servicio de DB que mantener.
- **Stateless**: El backend no guarda estado entre requests (con excepciones).

### Excepciones

1. **Redis (Upstash)**: Se usa para jobs async, con TTL de 1 hora.
2. **Archivo JSON**: Métricas se persisten en `temp/metrics.json` para desarrollo.
3. **localStorage**: El widget guarda el estado de onboarding en el navegador.

---

## Dónde se guarda la información

### 1. API Keys / Clientes

| Aspecto | Detalle |
|---|---|
| **Dónde** | `lib/auth.ts` — objeto JavaScript hardcoded |
| **Persistencia** | Código fuente (no se pierde) |
| **Actualización** | Requiere modificar código y re-deploy |

```typescript
// lib/auth.ts
const CLIENTS: Record<string, ClientInfo> = {
  'demo_key_12345': { id: 'client_001', name: 'Demo Company', apiKey: 'demo_key_12345', active: true },
  'demotryon01': { id: 'client_002', name: 'Demo TryOn', apiKey: 'demotryon01', active: true },
  'testtryon01': { id: 'client_003', name: 'Test TryOn', apiKey: 'testtryon01', active: true },
};
```

> **Problema**: Los clientes creados dinámicamente vía `/api/clients` se guardan en un `Map` en `metrics-store.ts` (in-memory), pero NO se registran en `auth.ts`. Esto significa que **no pueden autenticarse** para generar imágenes.

### 2. Clientes registrados (Dashboard)

| Aspecto | Detalle |
|---|---|
| **Dónde** | `lib/metrics-store.ts` — `Map` en memoria |
| **Persistencia** | Se pierde al reiniciar (Vercel cold start) |
| **Seed** | 3 clientes hardcoded al inicializar |

```typescript
// lib/metrics-store.ts
const registeredClients: Map<string, { name: string; createdAt: string }> = new Map([
  ['demotryon01', { name: 'Demo TryOn', createdAt: '2025-12-06' }],
  ['testtryon01', { name: 'Test TryOn', createdAt: '2025-12-07' }],
  ['demo_key_12345', { name: 'Demo Company', createdAt: '2025-01-01' }],
]);
```

### 3. Métricas / Eventos

| Aspecto | Detalle |
|---|---|
| **Dónde (primario)** | `lib/metrics-store.ts` — `Map<string, MetricEvent[]>` en memoria |
| **Dónde (backup)** | `temp/metrics.json` — archivo JSON local |
| **Dónde (externo)** | Enviado a `METRICS_ENDPOINT` (otro backend) |
| **Dónde (Redis)** | También se guarda en Redis como `generations:{id}` |
| **Persistencia** | En memoria: se pierde al restart. Archivo: se carga al iniciar. Redis: 30 días TTL |
| **Límite** | 1000 eventos por cliente (FIFO, los más viejos se eliminan) |

### 4. Jobs (Generación Asíncrona)

| Aspecto | Detalle |
|---|---|
| **Dónde** | Upstash Redis |
| **Key format** | `job:{id}` |
| **TTL** | 3600 segundos (1 hora) |
| **Persistencia** | Auto-eliminación después de 1 hora |

### 5. Resultados de Generación

| Aspecto | Detalle |
|---|---|
| **Dónde** | NO se guardan |
| **Imágenes resultado** | URL temporal de FAL CDN (expira eventualmente) |
| **Asociación** | No se guarda qué usuario generó qué imagen |

### 6. Sesión de Admin

| Aspecto | Detalle |
|---|---|
| **Dónde** | Cookie `admin_auth` en el navegador |
| **Valor** | String literal `'authenticated'` |
| **Duración** | 7 días, httpOnly, secure en prod |
| **Seguridad** | Básica — no hay JWT, no hay session ID |

### 7. Onboarding del Widget

| Aspecto | Detalle |
|---|---|
| **Dónde** | `localStorage` del navegador del usuario final |
| **Key** | `tryon_onboarding_done` |
| **Nota** | Bug actual: el widget LEE este key pero nunca lo ESCRIBE |

---

## Estructura de Datos

### ClientInfo (auth)

```typescript
interface ClientInfo {
  id: string;        // "client_001"
  name: string;      // "Demo Company"
  apiKey: string;    // "demo_key_12345"
  active: boolean;   // true/false
}
```

### MetricEvent (métricas)

```typescript
interface MetricEvent {
  id: string;           // "evt_1234567890_abc123def"
  type: 'generation';   // Tipo de evento
  timestamp: string;    // ISO 8601
  model: string;        // "fal-virtual-try-on" | "nano-banana-pro"
  clientKey: string;    // API key del cliente
  clientId: string;     // ID interno del cliente
  clientName: string;   // Nombre del cliente
}
```

### ClientMetrics (agregados)

```typescript
interface ClientMetrics {
  clientKey: string;
  clientId: string;
  clientName: string;
  totalGenerations: number;
  lastGeneration: string | null;      // ISO timestamp
  generationsByModel: Record<string, number>;
  recentEvents: MetricEvent[];        // Últimos 50
}
```

### JobData (jobs async)

```typescript
interface JobData {
  id: string;                  // "job_abc123_def456789"
  status: 'queued' | 'processing' | 'done' | 'error';
  created_at: number;          // ms epoch
  fal_start: number | null;    // ms epoch
  fal_end: number | null;      // ms epoch
  completed_at: number | null; // ms epoch
  image_url: string | null;    // URL del resultado
  error: string | null;        // Mensaje de error
  client_id?: string;          // ID del cliente
  garments_count?: number;     // Número de prendas
}
```

### GenerationMetric (Redis)

```typescript
interface GenerationMetric {
  id: string;                // "gen_1234567890_abc123"
  client_id: string;
  timestamp: number;         // ms epoch
  endpoint: string;          // "/api/images/generate"
  duration_total_ms: number;
  duration_fal_ms: number;
  status: 'success' | 'error';
  error: string | null;
  metadata: {
    model: string;
    garments_count: number;
    cold_start: boolean;
    job_id?: string;
  };
}
```

---

## Por qué NO hay DB

### Razones del diseño actual

1. **MVP rápido**: El proyecto se desarrolló para validar la idea, no para escalar.
2. **Costo**: Cero costo en hosting (Vercel free + sin DB).
3. **Simplicidad operativa**: No hay migraciones, no hay backups, no hay ORM.
4. **Naturaleza stateless**: La operación core (generar imagen) no necesita estado.

### Consecuencias

| Consecuencia | Impacto |
|---|---|
| Métricas se pierden en restart | Medio — se recuperan parcialmente del archivo JSON |
| Clientes no se pueden crear dinámicamente para auth | Alto — bloquea el flujo de onboarding empresarial |
| No hay historial de generaciones | Medio — no se puede mostrar al usuario sus generaciones previas |
| No hay rate limiting real | Alto — riesgo de abuso |
| No hay facturación automática | Medio — todo manual |

---

## Cómo agregar DB en el futuro

### Opción 1: PostgreSQL + Prisma (Recomendada)

**Ventajas**: SQL maduro, Prisma tiene excelente DX, hosting barato (Supabase, Neon).

```prisma
// schema.prisma
model Client {
  id        String   @id @default(cuid())
  name      String
  email     String?
  apiKey    String   @unique
  active    Boolean  @default(true)
  limit     Int      @default(5000)
  createdAt DateTime @default(now())
  
  generations Generation[]
}

model Generation {
  id          String   @id @default(cuid())
  clientId    String
  model       String
  status      String   // "success" | "error"
  durationMs  Int?
  falDuration Int?
  imageUrl    String?
  error       String?
  createdAt   DateTime @default(now())
  
  client Client @relation(fields: [clientId], references: [id])
}

model Session {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

**Hosting recomendado**: Neon (serverless Postgres, free tier generoso)

### Opción 2: MongoDB + Mongoose

**Ventajas**: Flexible, sin esquema fijo, JSON-native.

```javascript
// Client schema
{
  _id: ObjectId,
  name: String,
  email: String,
  apiKey: { type: String, unique: true },
  active: Boolean,
  limit: Number,
  createdAt: Date,
}

// Generation schema
{
  _id: ObjectId,
  clientId: ObjectId,
  model: String,
  status: String,
  durationMs: Number,
  imageUrl: String,
  createdAt: Date,
}
```

**Hosting recomendado**: MongoDB Atlas (free tier: 512MB)

### Opción 3: Supabase (PostgreSQL + Auth + Storage)

**Ventajas**: Todo-en-uno (DB + Auth + Storage + Realtime), Postgres bajo el capó.

```sql
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  api_key TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  usage_limit INT DEFAULT 5000,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  duration_ms INT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Migración necesaria

| Qué mover | De | A | Prioridad |
|---|---|---|---|
| Clientes/API keys | `lib/auth.ts` (hardcoded) | Tabla `clients` | **ALTA** |
| Métricas/Eventos | `lib/metrics-store.ts` (in-memory) | Tabla `generations` | **ALTA** |
| Clientes registrados | `Map` en `metrics-store.ts` | Tabla `clients` | **ALTA** |
| Jobs | Redis (OK actualmente) | Mantener Redis | Baja |
| Sesiones admin | Cookie simple | Tabla `sessions` o JWT | Media |
| Onboarding | localStorage | Mantener localStorage | Ninguna |

---

> **Referencias**: Ver [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) para el plan paso a paso de migración.
