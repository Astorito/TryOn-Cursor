# TESTING - Testing y Calidad

## Tabla de Contenidos

- [Estado actual de testing](#estado-actual-de-testing)
- [Herramientas de prueba existentes](#herramientas-de-prueba-existentes)
- [Script de análisis de latencia](#script-de-análisis-de-latencia)
- [Pruebas manuales paso a paso](#pruebas-manuales-paso-a-paso)
- [Stack de testing recomendado](#stack-de-testing-recomendado)
- [Plan de implementación de tests](#plan-de-implementación-de-tests)
- [Tests unitarios propuestos](#tests-unitarios-propuestos)
- [Tests de integración propuestos](#tests-de-integración-propuestos)
- [Tests E2E propuestos](#tests-e2e-propuestos)
- [Tests de carga propuestos](#tests-de-carga-propuestos)

---

## Estado Actual de Testing

| Tipo | Estado | Herramientas |
|---|---|---|
| Tests unitarios | ❌ No existen | - |
| Tests de integración | ❌ No existen | - |
| Tests E2E | ❌ No existen | - |
| Tests de carga | ⚠️ Script manual | `scripts/analyze-latency.ts` |
| Páginas de prueba manual | ✅ Disponibles | `public/*.html` |
| Linting | ✅ Configurado | ESLint (Next.js defaults) |
| Type checking | ✅ TypeScript | `tsconfig.json` strict mode |

> **Resumen**: El proyecto NO tiene tests automatizados. La única verificación es TypeScript (type checking) y ESLint. Existen páginas HTML para pruebas manuales.

---

## Herramientas de Prueba Existentes

### Páginas HTML de Prueba Manual

#### 1. `public/demo.html` - Demo Interactiva

**URL**: `/demo.html`
**Propósito**: Demostración completa del widget para clientes potenciales.
**Contenido**: Página HTML que carga el widget via `<script>` y simula un e-commerce.

**Uso**:
```bash
# Iniciar servidor
npm run dev

# Abrir en browser
open http://localhost:3000/demo.html
```

**Qué probar**:
- [ ] El widget FAB aparece en la esquina inferior derecha
- [ ] Click en FAB abre el panel
- [ ] Se puede subir una imagen de persona
- [ ] Se puede seleccionar hasta 3 prendas
- [ ] El botón "Probar" genera una imagen
- [ ] La imagen resultante se muestra con zoom 2x
- [ ] El botón "Descargar" funciona
- [ ] "Reiniciar" limpia el estado

#### 2. `public/test-widget.html` - Test de Widget

**URL**: `/test-widget.html`
**Propósito**: Prueba del widget con configuración personalizable.
**Uso**: Permite cambiar API key y URL del backend para probar contra diferentes entornos.

#### 3. `public/test-async.html` - Test Asíncrono

**URL**: `/test-async.html`
**Propósito**: Prueba del flujo asíncrono de jobs.
**Qué probar**:
- [ ] Submit de un job devuelve `jobId` rápidamente
- [ ] Polling a `/api/jobs/{id}/status` muestra progreso
- [ ] El status cambia de `queued` → `processing` → `done`
- [ ] La imagen final se muestra correctamente

#### 4. `public/diagnostico.html` - Diagnóstico

**URL**: `/diagnostico.html`
**Propósito**: Diagnóstico de problemas de conectividad y configuración.
**Qué verifica**:
- Conexión al backend
- Estado del health check
- Latencia de red
- Estado de Redis

---

## Script de Análisis de Latencia

**Archivo**: `scripts/analyze-latency.ts`

**Propósito**: Analizar los logs de timing generados por `/api/images/generate` para calcular métricas de latencia.

**Uso**:
```bash
npx ts-node scripts/analyze-latency.ts
```

**Input esperado**: Lee logs JSON con formato:
```json
{
  "type": "GENERATION_TIMING",
  "requestId": "gen_xxx",
  "total_backend_ms": 6200,
  "fal_duration_ms": 5800,
  "backend_overhead_ms": 400,
  "cold_start": false
}
```

**Output**: Métricas agregadas:
- P50, P95, P99 de latencia total
- P50, P95, P99 de latencia FAL
- Porcentaje de cold starts
- Overhead del backend
- Distribución por rangos de tiempo

---

## Pruebas Manuales Paso a Paso

### Test 1: Health Check

```bash
curl http://localhost:3000/api/health
# Esperado: {"status":"healthy",...}
```

### Test 2: Widget JS

```bash
curl http://localhost:3000/api/widget | head -5
# Esperado: contenido JavaScript del widget
```

### Test 3: Generación síncrona

```bash
curl -X POST http://localhost:3000/api/images/generate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "demo_key_12345",
    "userImage": "<base64_de_persona>",
    "garments": ["<base64_de_prenda>"]
  }'
# Esperado: {"success":true,"resultImage":"https://fal.media/..."}
# Tiempo: ~6-10s
```

### Test 4: Upload de imagen

```bash
curl -X POST http://localhost:3000/api/images/upload \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "demo_key_12345",
    "image": "<base64>"
  }'
# Esperado: {"success":true,"url":"https://fal.media/..."}
```

### Test 5: Job asíncrono

```bash
# Submit
JOB=$(curl -s -X POST http://localhost:3000/api/jobs/submit \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "demo_key_12345",
    "personImage": "<base64>",
    "garmentImages": ["<base64>"]
  }')
echo $JOB
# Esperado: {"success":true,"jobId":"job_xxx",...}

# Polling
JOB_ID=$(echo $JOB | jq -r '.jobId')
curl http://localhost:3000/api/jobs/$JOB_ID/status
# Esperado: {"status":"processing",...} → {"status":"done","image_url":"..."}
```

### Test 6: Auth login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password": "tryon_admin_2024"}'
# Esperado: {"success":true} + Set-Cookie header
```

### Test 7: API key inválida

```bash
curl -X POST http://localhost:3000/api/images/generate \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "invalid_key", "userImage": "x", "garments": ["x"]}'
# Esperado: 401 {"success":false,"error":"API key inválida..."}
```

---

## Stack de Testing Recomendado

### Para Tests Unitarios + Integración

```json
// Agregar a package.json devDependencies:
{
  "vitest": "^2.0.0",
  "@testing-library/react": "^16.0.0",
  "@testing-library/jest-dom": "^6.0.0",
  "msw": "^2.0.0"
}
```

**¿Por qué Vitest?**:
- Nativo para proyectos Vite/Next.js
- Compatible con Jest API (sin curva de aprendizaje)
- Más rápido que Jest
- Soporte nativo de TypeScript y ESM

### Para Tests E2E

```json
{
  "playwright": "^1.45.0",
  "@playwright/test": "^1.45.0"
}
```

### Para Tests de Carga

```json
{
  "k6": "CLI tool (no npm)",
  "artillery": "^2.0.0"
}
```

### Configuración Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // 'jsdom' para componentes React
    include: ['**/*.test.ts', '**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**', 'app/api/**'],
    },
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

---

## Plan de Implementación de Tests

### Fase 1: Tests Unitarios de Librerías (1-2 días)

| Archivo | Tests necesarios | Prioridad |
|---|---|---|
| `lib/auth.ts` | Validación de API keys, claves inválidas | Alta |
| `lib/cors.ts` | Headers CORS correctos | Media |
| `lib/latency.ts` | Cálculo de timings | Media |
| `lib/metrics-store.ts` | CRUD de eventos, aggregaciones | Alta |
| `lib/job-store.ts` | Ciclo de vida de jobs (mock Redis) | Alta |

### Fase 2: Tests de API Routes (2-3 días)

| Endpoint | Tests necesarios | Prioridad |
|---|---|---|
| `/api/health` | Response format, status codes | Alta |
| `/api/images/generate` | Auth, validation, mocking FAL | Alta |
| `/api/images/upload` | Auth, upload mock | Media |
| `/api/jobs/submit` | Crear job, mock Redis | Alta |
| `/api/jobs/[id]/status` | Get status, not found | Alta |
| `/api/clients` | CRUD completo | Media |
| `/api/auth/login` | Login/logout, cookies | Media |

### Fase 3: Tests E2E (2-3 días)

| Flujo | Tests necesarios | Prioridad |
|---|---|---|
| Widget flow | Abrir, subir foto, seleccionar prenda, generar | Alta |
| Dashboard login | Login, ver métricas | Media |
| Dashboard CRUD | Crear/editar/eliminar empresa | Media |

### Fase 4: Tests de Performance (1 día)

| Test | Herramienta | Prioridad |
|---|---|---|
| Latencia de generación | k6 | Alta |
| Concurrencia | k6 | Media |
| Cold start | Script custom | Media |

---

## Tests Unitarios Propuestos

### `lib/auth.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { validateApiKey } from './auth';

describe('validateApiKey', () => {
  it('returns client config for valid key', () => {
    const result = validateApiKey('demo_key_12345');
    expect(result).toEqual({
      clientId: 'demo_client',
      company: 'Demo Client',
    });
  });

  it('returns null for invalid key', () => {
    expect(validateApiKey('invalid_key')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(validateApiKey('')).toBeNull();
  });

  it('returns null for undefined-like values', () => {
    expect(validateApiKey(undefined as any)).toBeNull();
  });

  it('validates all registered keys', () => {
    const keys = ['demo_key_12345', 'demotryon01', 'testtryon01'];
    keys.forEach((key) => {
      expect(validateApiKey(key)).not.toBeNull();
    });
  });
});
```

### `lib/metrics-store.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsStore } from './metrics-store';

describe('MetricsStore', () => {
  let store: MetricsStore;

  beforeEach(() => {
    store = new MetricsStore();
  });

  it('records an event', () => {
    store.recordEvent('client1', {
      type: 'generation',
      timestamp: new Date().toISOString(),
      data: { success: true },
    });
    const events = store.getEvents('client1');
    expect(events).toHaveLength(1);
  });

  it('returns empty array for unknown client', () => {
    expect(store.getEvents('unknown')).toEqual([]);
  });

  it('calculates time series data', () => {
    // Agregar eventos en múltiples días
    const data = store.getTimeSeriesData('7d', 'all');
    expect(Array.isArray(data)).toBe(true);
  });

  it('calculates hourly distribution', () => {
    const dist = store.getHourlyDistribution('all');
    expect(dist).toHaveLength(24);
  });
});
```

### `lib/job-store.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis
vi.mock('./redis', () => ({
  getRedis: () => ({
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  }),
}));

import { createJob, getJob, markJobProcessing, markJobDone, markJobError } from './job-store';

describe('JobStore', () => {
  it('creates a job with queued status', async () => {
    const jobId = await createJob({
      personImage: 'test',
      garmentImages: ['test'],
    });
    expect(jobId).toMatch(/^job_/);
  });

  it('transitions job through lifecycle', async () => {
    const jobId = 'job_test_123';
    await markJobProcessing(jobId);
    await markJobDone(jobId, 'https://result.com/image.png');
    const job = await getJob(jobId);
    expect(job?.status).toBe('done');
  });

  it('marks job as error', async () => {
    const jobId = 'job_test_456';
    await markJobError(jobId, 'FAL error');
    const job = await getJob(jobId);
    expect(job?.status).toBe('error');
    expect(job?.error).toBe('FAL error');
  });
});
```

---

## Tests de Integración Propuestos

### `app/api/health/route.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

describe('GET /api/health', () => {
  it('returns 200 with healthy status', async () => {
    const req = new NextRequest('http://localhost:3000/api/health');
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body).toHaveProperty('timestamp');
  });
});
```

### `app/api/images/generate/route.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock FAL client
vi.mock('@/lib/fal-client', () => ({
  generateWithFal: vi.fn().mockResolvedValue({
    success: true,
    resultImage: 'https://fal.media/test.png',
    timings: {},
  }),
}));

import { POST } from './route';
import { NextRequest } from 'next/server';

describe('POST /api/images/generate', () => {
  it('rejects without API key', async () => {
    const req = new NextRequest('http://localhost:3000/api/images/generate', {
      method: 'POST',
      body: JSON.stringify({ userImage: 'test', garments: ['test'] }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('rejects with invalid API key', async () => {
    const req = new NextRequest('http://localhost:3000/api/images/generate', {
      method: 'POST',
      body: JSON.stringify({
        apiKey: 'invalid',
        userImage: 'test',
        garments: ['test'],
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('rejects without garments', async () => {
    const req = new NextRequest('http://localhost:3000/api/images/generate', {
      method: 'POST',
      body: JSON.stringify({
        apiKey: 'demo_key_12345',
        userImage: 'test',
        garments: [],
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it('generates image with valid input', async () => {
    const req = new NextRequest('http://localhost:3000/api/images/generate', {
      method: 'POST',
      body: JSON.stringify({
        apiKey: 'demo_key_12345',
        userImage: 'data:image/jpeg;base64,abc123',
        garments: ['data:image/jpeg;base64,def456'],
      }),
    });

    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.resultImage).toBeDefined();
  });
});
```

---

## Tests E2E Propuestos

### `tests/e2e/widget.spec.ts` (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Widget', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo.html');
  });

  test('FAB button is visible', async ({ page }) => {
    const fab = page.locator('[data-testid="tryon-fab"]');
    await expect(fab).toBeVisible();
  });

  test('clicking FAB opens panel', async ({ page }) => {
    await page.click('[data-testid="tryon-fab"]');
    const panel = page.locator('[data-testid="tryon-panel"]');
    await expect(panel).toBeVisible();
  });

  test('can upload user image', async ({ page }) => {
    await page.click('[data-testid="tryon-fab"]');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('tests/fixtures/person.jpg');
    // Verificar que la imagen se muestra
    const preview = page.locator('[data-testid="user-image-preview"]');
    await expect(preview).toBeVisible();
  });

  test('generate button disabled without images', async ({ page }) => {
    await page.click('[data-testid="tryon-fab"]');
    const generateBtn = page.locator('[data-testid="generate-btn"]');
    await expect(generateBtn).toBeDisabled();
  });
});
```

### `tests/e2e/dashboard.spec.ts` (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('can login with correct password', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="password"]', 'tryon_admin_2024');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('shows error with wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="password"]', 'wrong_password');
    await page.click('button[type="submit"]');
    await expect(page.locator('.error')).toBeVisible();
  });
});
```

---

## Tests de Carga Propuestos

### k6 Script: `tests/load/generate.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 5 },   // Ramp up
    { duration: '1m', target: 5 },     // Sustained
    { duration: '30s', target: 10 },   // Peak
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<15000'],  // 95% under 15s
    http_req_failed: ['rate<0.1'],       // <10% errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const PERSON_IMAGE = open('./fixtures/person.jpg', 'b');
const GARMENT_IMAGE = open('./fixtures/garment.jpg', 'b');

export default function () {
  const payload = JSON.stringify({
    apiKey: 'demo_key_12345',
    userImage: `data:image/jpeg;base64,${encoding.b64encode(PERSON_IMAGE)}`,
    garments: [`data:image/jpeg;base64,${encoding.b64encode(GARMENT_IMAGE)}`],
  });

  const res = http.post(`${BASE_URL}/api/images/generate`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '60s',
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has result image': (r) => JSON.parse(r.body).resultImage !== undefined,
  });

  sleep(5); // Wait between requests
}
```

### Comando de ejecución:

```bash
k6 run --env BASE_URL=https://tu-app.vercel.app tests/load/generate.js
```

---

> **Referencias**: Ver [PERFORMANCE_AND_OPTIMIZATION.md](PERFORMANCE_AND_OPTIMIZATION.md) para métricas de latencia, y [API_REFERENCE.md](API_REFERENCE.md) para los formatos exactos de request/response de cada endpoint.
