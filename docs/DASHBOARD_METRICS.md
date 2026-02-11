# DASHBOARD METRICS - Sistema de Métricas y Dashboard

## Tabla de Contenidos

- [Propósito](#propósito)
- [Arquitectura de métricas](#arquitectura-de-métricas)
- [Tipos de eventos](#tipos-de-eventos)
- [Dashboard - Páginas](#dashboard---páginas)
- [Endpoints del dashboard](#endpoints-del-dashboard)
- [Autenticación del dashboard](#autenticación-del-dashboard)
- [Visualizaciones](#visualizaciones)
- [Componentes implementados](#componentes-implementados)

---

## Propósito

El sistema de métricas tiene tres objetivos:

1. **Monitorear uso**: Cuántas generaciones hace cada empresa.
2. **Detectar abusos**: Empresas que excedan su límite.
3. **Preparar facturación**: Datos de uso por cliente para cobrar.

---

## Arquitectura de Métricas

```
Widget (Frontend)                Backend                    Dashboard
     │                              │                          │
     ├─ POST /images/generate ─────►│                          │
     │                              ├─ recordEvent() ──┐       │
     │                              │                  │       │
     │                              │  ┌───────────────▼────┐  │
     │                              │  │ In-Memory Store    │  │
     │                              │  │ (Map<string, []>)  │◄─┤── GET /api/metrics
     │                              │  └─────────┬──────────┘  │
     │                              │            │             │
     │                              │  ┌─────────▼──────────┐  │
     │                              │  │ temp/metrics.json   │  │  ← Persistencia local
     │                              │  └────────────────────┘  │
     │                              │                          │
     │                              ├─ POST to METRICS_ENDPOINT│  ← Dashboard externo
     │                              │                          │
     │                              ├─ Redis: zadd/set ────────┤  ← Redis backup
     │                              │                          │
```

### Flujo de registro de métricas

1. El endpoint `/api/images/generate` llama a `recordEvent()` tras cada generación.
2. `recordEvent()` (en `metrics-store.ts`):
   - Busca el cliente por API key.
   - Guarda en in-memory store (`Map`).
   - Persiste a `temp/metrics.json`.
   - Guarda en Redis como `generations:{id}` con TTL de 30 días.
   - También registra en sorted set `metrics:{client_id}:generations`.
3. `sendMetricsEvent()` (en `metrics.ts`) envía el evento a un dashboard externo (`METRICS_ENDPOINT`).

---

## Tipos de Eventos

### `generation`

```typescript
{
  type: 'generation',
  timestamp: '2026-01-15T10:30:00.000Z',
  model: 'fal-virtual-try-on',
  clientId: 'client_001',
  clientName: 'Demo Company',
}
```

Actualmente solo hay un tipo de evento (`generation`). Campos:

| Campo | Tipo | Descripción |
|---|---|---|
| `type` | `'generation'` | Siempre "generation" |
| `timestamp` | ISO 8601 string | Momento de la generación |
| `model` | string | Modelo usado: `'fal-virtual-try-on'`, `'nano-banana-pro'`, `'fal-virtual-try-on-error'` |
| `clientId` | string | ID interno del cliente |
| `clientName` | string | Nombre legible del cliente |

---

## Dashboard - Páginas

### Login (`/login`)

- Formulario de contraseña simple.
- Contraseña por defecto: `tryon_admin_2024` (env var `ADMIN_PASSWORD`).
- Al autenticarse → cookie `admin_auth` por 7 días.
- Redirect a la página solicitada o `/dashboard`.

### Dashboard Principal (`/dashboard`)

Muestra:

1. **Metric Cards** (4):
   - Total Empresas
   - Generaciones Totales
   - Promedio por Empresa
   - Cerca del Límite (empresas con <10% restante)

2. **Formulario** para crear nueva empresa:
   - Campo: Alias + Email
   - Genera API key automático (`tryon_{timestamp}_{random}`)
   - Copia la key al clipboard

3. **Tabla de empresas**:
   - Filtros: Buscar por nombre/email, estado (Todas/Activas/Cerca del límite)
   - Columnas: Empresa, Email, Usadas, Límite, Disponibles (con barra de progreso)
   - Barra de progreso: verde (<70%), naranja (70-90%), rojo (>90%)

### Analíticas (`/dashboard/analytics`)

Muestra:

1. **Filtros**:
   - Selector de empresas (toggle buttons)
   - Período: 1M, 3M, 6M, 1 Año, All Time

2. **Metric Cards** (3):
   - Crecimiento Mensual (%)
   - Promedio Diario
   - Ingreso Estimado ($0.04/generación)

3. **Gráficos** (4):
   - **LineChart**: Generaciones por mes (una línea por empresa seleccionada)
   - **PieChart**: Distribución por empresa (porcentaje del total)
   - **BarChart**: Distribución por hora del día
   - **Ranking**: Top empresas con barras de progreso porcentual

---

## Endpoints del Dashboard

### `GET /api/metrics`

**Autenticación**: `x-admin-key` header O cookie `admin_auth` O `x-client-key` header.

**Con admin key** (todas las métricas):
```json
{
  "success": true,
  "metrics": {
    "clients": [
      {
        "clientKey": "demotryon01",
        "clientId": "client_002",
        "clientName": "Demo TryOn",
        "totalGenerations": 150,
        "lastGeneration": "2026-01-15T10:30:00Z",
        "generationsByModel": { "fal-virtual-try-on": 150 },
        "recentEvents": [...]
      }
    ],
    "totals": {
      "totalClients": 3,
      "totalGenerations": 500,
      "generationsByModel": { "fal-virtual-try-on": 500 }
    }
  }
}
```

**Con client key** (solo métricas del cliente):
```json
{
  "success": true,
  "metrics": {
    "clientKey": "demotryon01",
    "totalGenerations": 150,
    ...
  }
}
```

**Con query param `?client_id=X`**: Retorna solo ese cliente (requiere admin).

### `GET /api/clients`

**Autenticación**: Admin key o cookie.

```json
{
  "success": true,
  "clients": [
    {
      "id": "demotryon01",
      "name": "Demo TryOn",
      "email": null,
      "api_key": "demotryon01",
      "created_at": "2025-12-06",
      "usage_count": 150,
      "limit": 5000,
      "lastGeneration": "2026-01-15T10:30:00Z"
    }
  ]
}
```

### `POST /api/clients`

**Body**: `{ "name": "Empresa X", "email": "empresa@example.com" }`

```json
{
  "success": true,
  "client": {
    "id": "tryon_abc123_xyz",
    "name": "Empresa X",
    "api_key": "tryon_abc123_xyz",
    "created_at": "2026-01-15T10:30:00Z",
    "usage_count": 0,
    "limit": 5000
  }
}
```

### `DELETE /api/clients?clientKey=tryon_abc123_xyz`

```json
{ "success": true, "message": "Client deleted" }
```

### `GET /api/admin/analytics`

**Query params**: `clients=key1,key2&period=6M`

```json
{
  "timeSeries": [
    { "month": "jul", "demotryon01": 25, "testtryon01": 10 },
    { "month": "ago", "demotryon01": 30, "testtryon01": 15 }
  ],
  "hourly": [
    { "hour": "00:00", "count": 5 },
    { "hour": "01:00", "count": 2 }
  ],
  "ranking": [
    { "name": "Demo TryOn", "count": 150, "percentage": 75 }
  ],
  "distribution": [
    { "name": "Demo TryOn", "value": 150 }
  ],
  "totalGenerations": 200,
  "avgDaily": 7,
  "avgRevenue": 8,
  "growthRate": 12.5
}
```

### `POST /api/ingest`

**Header requerido**: `x-client-key`
**Body**:
```json
{
  "type": "generation",
  "timestamp": "2026-01-15T10:30:00Z",
  "model": "fal-virtual-try-on",
  "clientId": "client_001",
  "clientName": "Demo Company"
}
```

---

## Autenticación del Dashboard

### Mecanismos

1. **Admin Key** (`x-admin-key` header):
   - Valor: env var `ADMIN_KEY` o default `admin_secret_key_2024`
   - Da acceso a todas las métricas de todas las empresas.

2. **Cookie de sesión** (`admin_auth`):
   - Se establece al hacer login con contraseña.
   - Valor: string literal `'authenticated'`.
   - Duración: 7 días, httpOnly, secure en producción.

3. **Client Key** (`x-client-key` header):
   - Da acceso solo a métricas del propio cliente.
   - El valor es el API key del cliente.

### Flujo de login

```
POST /api/auth/login
Body: { "password": "tryon_admin_2024" }
→ Set-Cookie: admin_auth=authenticated; HttpOnly; MaxAge=604800
→ { "success": true }

DELETE /api/auth/login
→ Delete-Cookie: admin_auth
→ { "success": true }
```

---

## Visualizaciones

### Implementadas (con Recharts)

| Tipo | Componente | Datos | Ubicación |
|---|---|---|---|
| LineChart | Generaciones por mes | `timeSeries` array | `/dashboard/analytics` |
| PieChart | Distribución por empresa | `distribution` array | `/dashboard/analytics` |
| BarChart | Distribución por hora | `hourly` array | `/dashboard/analytics` |
| Ranking | Top empresas | `ranking` array | `/dashboard/analytics` |
| MetricCards | KPIs | Calculados en frontend | `/dashboard` y `/dashboard/analytics` |
| CompanyTable | Lista empresas | `clients` array | `/dashboard` |
| Progress bars | Uso/Límite | `usage_count/limit` | `CompanyTable` |

### Paleta de colores para gráficos

```javascript
const COLORS = ['#8b5cf6', '#f97316', '#3b82f6', '#10b981'];
// Violeta, naranja, azul, verde
```

---

## Componentes Implementados

### `components/dashboard/MetricCard.tsx`

Card de métrica con gradiente de color y emoji.

```tsx
<MetricCard title="Total Empresas" value={3} icon="🏢" color="blue" />
```

Colores disponibles: `blue`, `green`, `purple`, `orange`.

### `components/dashboard/CompanyTable.tsx`

Tabla con búsqueda, filtros y barras de progreso.

Props: `clients: any[]`, `onUpdate: () => void`

Filtros de estado:
- **Todas**: Sin filtro
- **Activas**: `usage_count > 0`
- **Cerca del Límite**: `remaining < limit * 0.1`

### `components/dashboard/CompanyForm.tsx`

Formulario para crear empresa.

Props: `onSuccess: () => void`

Campos: Alias (text), Email (email), Botón "Generar Token".

### `components/MetricsDashboard.tsx`

Dashboard alternativo (legacy) con tema oscuro y autenticación por admin key. Incluye su propio login, selector de empresas, y snippet de integración. **No se usa actualmente** en el flujo principal (el dashboard principal usa las páginas de `/dashboard/`).

---

> **Referencias**: Ver [API_REFERENCE.md](API_REFERENCE.md) para detalle completo de cada endpoint, y [ARCHITECTURE.md](ARCHITECTURE.md) para la estructura general.
