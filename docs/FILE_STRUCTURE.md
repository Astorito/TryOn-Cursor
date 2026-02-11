# FILE STRUCTURE - Estructura de Archivos

## Tabla de Contenidos

- [Árbol completo](#árbol-completo)
- [Archivos de configuración (raíz)](#archivos-de-configuración-raíz)
- [Directorio app/](#directorio-app)
- [Directorio lib/](#directorio-lib)
- [Directorio components/](#directorio-components)
- [Directorio public/](#directorio-public)
- [Directorio scripts/](#directorio-scripts)
- [Directorio temp/](#directorio-temp)
- [Directorio docs/](#directorio-docs)
- [Convenciones de nomenclatura](#convenciones-de-nomenclatura)

---

## Árbol Completo

```
Tryon-Backend-definitivo/
│
├── 📄 package.json              # Dependencias y scripts npm
├── 📄 package-lock.json         # Lock file de dependencias
├── 📄 next.config.js            # Configuración de Next.js (CORS, headers, CSP)
├── 📄 tsconfig.json             # Configuración de TypeScript
├── 📄 tailwind.config.js        # Configuración de Tailwind CSS
├── 📄 postcss.config.js         # Configuración de PostCSS (requerido por Tailwind)
├── 📄 vercel.json               # Configuración de Vercel (protection bypass)
├── 📄 middleware.ts             # Edge middleware (CORS + auth redirect)
├── 📄 next-env.d.ts             # Tipos auto-generados de Next.js
├── 📄 README.md                 # Documentación general del proyecto
├── 📄 ARCHITECTURE.md           # Documentación de arquitectura (legacy, ver docs/)
├── 📄 EMPRESAS.md               # Lista de empresas clientes
├── 📄 PERFORMANCE_TESTING.md    # Notas de testing de performance (legacy)
│
├── 📁 app/                      # ═══ NEXT.JS APP ROUTER ═══
│   ├── 📄 globals.css           # Estilos globales (Tailwind imports)
│   ├── 📄 layout.tsx            # Layout raíz (html, body, metadata)
│   ├── 📄 page.tsx              # Página principal "/" (landing/redirect)
│   │
│   ├── 📁 api/                  # ═══ API ROUTES (Backend) ═══
│   │   │
│   │   ├── 📁 widget/
│   │   │   └── 📄 route.ts     # GET /api/widget → Sirve widget-core.js
│   │   │
│   │   ├── 📁 images/
│   │   │   ├── 📁 generate/
│   │   │   │   └── 📄 route.ts # POST /api/images/generate → Generación sync
│   │   │   └── 📁 upload/
│   │   │       └── 📄 route.ts # POST /api/images/upload → Pre-upload a FAL CDN
│   │   │
│   │   ├── 📁 jobs/
│   │   │   ├── 📁 submit/
│   │   │   │   └── 📄 route.ts # POST /api/jobs/submit → Job asíncrono
│   │   │   ├── 📁 [id]/
│   │   │   │   └── 📁 status/
│   │   │   │       └── 📄 route.ts # GET /api/jobs/:id/status → Polling
│   │   │   └── 📁 health/
│   │   │       └── 📄 route.ts # GET /api/jobs/health → Redis health
│   │   │
│   │   ├── 📁 health/
│   │   │   └── 📄 route.ts     # GET /api/health → Health check + warm-up
│   │   │
│   │   ├── 📁 auth/
│   │   │   └── 📁 login/
│   │   │       └── 📄 route.ts # POST /api/auth/login → Login admin
│   │   │
│   │   ├── 📁 clients/
│   │   │   └── 📄 route.ts     # CRUD /api/clients → Gestión empresas
│   │   │
│   │   ├── 📁 metrics/
│   │   │   └── 📄 route.ts     # GET /api/metrics → Métricas
│   │   │
│   │   ├── 📁 ingest/
│   │   │   └── 📄 route.ts     # POST /api/ingest → Ingesta de eventos
│   │   │
│   │   └── 📁 admin/
│   │       └── 📁 analytics/
│   │           └── 📄 route.ts # GET /api/admin/analytics → Datos para charts
│   │
│   ├── 📁 login/
│   │   └── 📄 page.tsx         # Página de login "/login"
│   │
│   ├── 📁 dashboard/
│   │   ├── 📄 layout.tsx       # Layout del dashboard (sidebar, navegación)
│   │   ├── 📄 page.tsx         # Dashboard principal "/dashboard"
│   │   └── 📁 analytics/
│   │       └── 📄 page.tsx     # Analytics "/dashboard/analytics"
│   │
│   └── 📁 admin/
│       └── 📄 page.tsx         # Página admin "/admin" (legacy/redirect)
│
├── 📁 lib/                      # ═══ LIBRERÍAS COMPARTIDAS ═══
│   ├── 📄 auth.ts               # Validación de API keys (hardcoded)
│   ├── 📄 fal-client.ts         # Cliente FAL AI síncrono (person_image + garment_image)
│   ├── 📄 fal-async.ts          # Procesador FAL AI asíncrono (prompt + image_urls)
│   ├── 📄 banana-client.ts      # Cliente Banana.dev (stub no implementado)
│   ├── 📄 job-store.ts          # Store de jobs async en Redis
│   ├── 📄 redis.ts              # Singleton de Upstash Redis
│   ├── 📄 metrics.ts            # Helper de tracking de eventos
│   ├── 📄 metrics-store.ts      # Store in-memory de métricas + persistencia
│   ├── 📄 latency.ts            # Instrumentación de latencia/timings
│   ├── 📄 cors.ts               # Helper de CORS headers
│   ├── 📄 http-agent.ts         # HTTPS keep-alive agent (maxSockets: 50)
│   ├── 📄 widget-core.js        # ★ Widget embeddable (1507 líneas, Vanilla JS, IIFE)
│   └── 📄 widget-core.js.backup # Backup del widget
│
├── 📁 components/               # ═══ COMPONENTES REACT ═══
│   ├── 📄 MetricsDashboard.tsx  # Dashboard de métricas (legacy, completo)
│   └── 📁 dashboard/
│       ├── 📄 CompanyForm.tsx   # Formulario de crear/editar empresa
│       ├── 📄 CompanyTable.tsx  # Tabla de empresas con acciones
│       └── 📄 MetricCard.tsx    # Tarjeta de métrica individual
│
├── 📁 public/                   # ═══ ARCHIVOS ESTÁTICOS ═══
│   ├── 📄 demo.html             # Demo interactiva del widget
│   ├── 📄 test-widget.html      # Página de prueba del widget
│   ├── 📄 test-async.html       # Prueba del flujo asíncrono
│   └── 📄 diagnostico.html      # Herramienta de diagnóstico
│
├── 📁 scripts/                  # ═══ SCRIPTS DE UTILIDAD ═══
│   └── 📄 analyze-latency.ts   # Análisis de logs de latencia
│
├── 📁 temp/                     # ═══ DATOS TEMPORALES ═══
│   └── 📄 metrics.json          # Persistencia de métricas (auto-generado)
│
└── 📁 docs/                     # ═══ DOCUMENTACIÓN TÉCNICA ═══
    ├── 📄 OVERVIEW.md
    ├── 📄 UI_UX_SPECIFICATION.md
    ├── 📄 ARCHITECTURE.md
    ├── 📄 DATABASE_AND_STORAGE.md
    ├── 📄 PERFORMANCE_AND_OPTIMIZATION.md
    ├── 📄 DASHBOARD_METRICS.md
    ├── 📄 AI_INTEGRATION.md
    ├── 📄 API_REFERENCE.md
    ├── 📄 DEPLOYMENT.md
    ├── 📄 SECURITY.md
    ├── 📄 TESTING.md
    ├── 📄 MIGRATION_GUIDE.md
    ├── 📄 FILE_STRUCTURE.md       ← (este archivo)
    ├── 📄 DEPENDENCIES.md
    └── 📄 FUTURE_ROADMAP.md
```

---

## Archivos de Configuración (Raíz)

| Archivo | Propósito | Crítico |
|---|---|---|
| `package.json` | Dependencias, scripts npm, metadata del proyecto | ✅ |
| `next.config.js` | Config de Next.js: headers CORS, CSP, rewrites | ✅ |
| `tsconfig.json` | TypeScript: strict mode, paths aliases (`@/*`), target ES2017 | ✅ |
| `middleware.ts` | Edge middleware: CORS preflight, auth redirect para dashboard | ✅ |
| `vercel.json` | Config de Vercel: `x-vercel-protection-bypass: auto` | ✅ |
| `tailwind.config.js` | Tailwind CSS: content paths, theme extensions | ⚠️ |
| `postcss.config.js` | PostCSS: plugins para Tailwind | ⚠️ |
| `next-env.d.ts` | Auto-generado por Next.js: tipos de entorno | Auto |

---

## Directorio `app/`

Usa **Next.js App Router** (no Pages Router). Cada carpeta con `route.ts` define un API endpoint. Cada carpeta con `page.tsx` define una página.

### Páginas

| Ruta | Archivo | Descripción |
|---|---|---|
| `/` | `app/page.tsx` | Landing page / redirección |
| `/login` | `app/login/page.tsx` | Formulario de login admin |
| `/dashboard` | `app/dashboard/page.tsx` | Panel principal: empresas + métricas |
| `/dashboard/analytics` | `app/dashboard/analytics/page.tsx` | Gráficos analíticos (Recharts) |
| `/admin` | `app/admin/page.tsx` | Página admin (legacy) |

### API Routes

| Ruta | Métodos | Líneas | Descripción |
|---|---|---|---|
| `/api/widget` | GET | ~40 | Sirve `widget-core.js` |
| `/api/images/generate` | POST | ~120 | Generación síncrona con FAL |
| `/api/images/upload` | POST | ~80 | Pre-upload a FAL Storage |
| `/api/jobs/submit` | POST | ~90 | Crear job async |
| `/api/jobs/[id]/status` | GET | ~50 | Status de job (polling) |
| `/api/jobs/health` | GET | ~30 | Redis health check |
| `/api/health` | GET | ~50 | Health check + warm-up |
| `/api/auth/login` | POST | ~40 | Login con cookie |
| `/api/clients` | GET, POST, PUT, DELETE | ~150 | CRUD de empresas |
| `/api/metrics` | GET | ~60 | Obtener métricas |
| `/api/ingest` | POST | ~40 | Ingesta de eventos |
| `/api/admin/analytics` | GET | ~80 | Datos para charts |

---

## Directorio `lib/`

Librerías compartidas. No son API routes, son módulos importados por los routes.

| Archivo | Líneas | Descripción | Dependencias externas |
|---|---|---|---|
| `widget-core.js` | 1507 | Widget embeddable completo (IIFE) | Ninguna (vanilla JS) |
| `fal-client.ts` | ~220 | Cliente síncrono de FAL AI | `@fal-ai/client` |
| `fal-async.ts` | ~131 | Procesador async de FAL AI | `@fal-ai/client` |
| `metrics-store.ts` | ~404 | Store de métricas in-memory + file | `fs` (Node.js) |
| `job-store.ts` | ~120 | Store de jobs en Redis | `./redis` |
| `auth.ts` | ~30 | Map de API keys hardcodeadas | Ninguna |
| `redis.ts` | ~25 | Singleton de Upstash Redis | `@upstash/redis` |
| `latency.ts` | ~80 | Instrumentación de timings | Ninguna |
| `http-agent.ts` | ~15 | HTTPS keep-alive agent | `https` (Node.js) |
| `cors.ts` | ~30 | Helper de CORS | Ninguna |
| `metrics.ts` | ~40 | Helper de tracking | `./metrics-store` |
| `banana-client.ts` | ~60 | Stub de Banana.dev | Ninguna |

### Archivo más importante: `widget-core.js`

Es el producto principal. Un archivo JavaScript de ~1507 líneas que contiene:

```
widget-core.js
├── IIFE wrapper
├── State management (objeto plano)
├── Image compression (compressImage, optimizeForInference)
├── API calls (generateTryOn)
├── UI components
│   ├── FAB button
│   ├── Main panel
│   ├── Upload boxes (persona + 3 garments)
│   ├── Loading sequence (4 fases animadas)
│   ├── Result view (2x zoom)
│   └── Onboarding tooltip
├── Event handlers (drag & drop, file input, touch)
├── Shadow DOM setup
└── Auto-initialization
```

---

## Directorio `components/`

| Archivo | Tipo | Usa en | Props principales |
|---|---|---|---|
| `MetricsDashboard.tsx` | Client component | Legacy (no usado activamente) | - |
| `dashboard/CompanyForm.tsx` | Client component | `/dashboard` | `onSubmit`, `editingCompany` |
| `dashboard/CompanyTable.tsx` | Client component | `/dashboard` | `companies`, `onEdit`, `onDelete` |
| `dashboard/MetricCard.tsx` | Server component | `/dashboard` | `title`, `value`, `icon`, `trend` |

---

## Directorio `public/`

Archivos servidos estáticamente en la raíz del dominio.

| Archivo | Acceso | Propósito |
|---|---|---|
| `demo.html` | `/demo.html` | Demo del widget para clientes potenciales |
| `test-widget.html` | `/test-widget.html` | Testing manual del widget |
| `test-async.html` | `/test-async.html` | Testing del flujo asíncrono |
| `diagnostico.html` | `/diagnostico.html` | Diagnóstico de problemas |

---

## Directorio `scripts/`

| Archivo | Ejecución | Propósito |
|---|---|---|
| `analyze-latency.ts` | `npx ts-node scripts/analyze-latency.ts` | Análisis estadístico de logs de latencia |

---

## Directorio `temp/`

| Archivo | Auto-generado | Propósito |
|---|---|---|
| `metrics.json` | Sí | Persistencia de métricas entre reinicios del servidor |

> **Nota**: Este directorio y su contenido se crean automáticamente por `metrics-store.ts`. No debería commitearse a Git (idealmente en `.gitignore`).

---

## Convenciones de Nomenclatura

| Convención | Ejemplo | Descripción |
|---|---|---|
| Kebab-case para archivos lib | `fal-client.ts`, `job-store.ts` | Módulos de librería |
| PascalCase para componentes | `CompanyForm.tsx`, `MetricCard.tsx` | Componentes React |
| `route.ts` por convención Next.js | `app/api/health/route.ts` | API Route handlers |
| `page.tsx` por convención Next.js | `app/dashboard/page.tsx` | Páginas |
| `layout.tsx` por convención Next.js | `app/layout.tsx` | Layouts |
| `[param]` para rutas dinámicas | `app/api/jobs/[id]/` | Parámetros de URL |

---

> **Referencias**: Ver [ARCHITECTURE.md](ARCHITECTURE.md) para cómo se relacionan estos archivos entre sí, y [DEPENDENCIES.md](DEPENDENCIES.md) para detalles de cada dependencia.
