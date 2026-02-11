# OVERVIEW - Vista General del Proyecto TryOn

## Tabla de Contenidos

- [Descripción](#descripción)
- [Problema que resuelve](#problema-que-resuelve)
- [Stack tecnológico](#stack-tecnológico)
- [Dependencias](#dependencias)
- [Arquitectura de alto nivel](#arquitectura-de-alto-nivel)
- [Flujo de datos](#flujo-de-datos)
- [Modelo de negocio](#modelo-de-negocio)

---

## Descripción

**TryOn** es un sistema de **virtual try-on** (probador virtual) basado en inteligencia artificial. Permite a los usuarios de tiendas online probarse prendas de vestir de forma virtual: suben una foto suya y una o más imágenes de prendas, y el sistema genera una imagen donde aparecen "vistiendo" esas prendas.

El producto se entrega como un **widget embebible** — un simple `<script>` tag que cualquier ecommerce puede pegar en su sitio para ofrecer la funcionalidad de try-on a sus clientes, sin necesidad de desarrollo adicional.

## Problema que resuelve

1. **Para tiendas online**: Reduce devoluciones (la ropa "se ve" antes de comprar), aumenta conversión y ofrece una experiencia diferenciadora.
2. **Para compradores**: Permite visualizar cómo les quedan las prendas sin ir a una tienda física.
3. **Para integradores**: Una sola línea de código (`<script>` tag) para añadir IA generativa a cualquier web.

## Stack Tecnológico

| Capa | Tecnología | Versión | Justificación |
|---|---|---|---|
| **Framework** | Next.js | ^15.0.0 | SSR, API routes, deployment nativo en Vercel |
| **Runtime** | Node.js | >=18.0.0 | Requerido por Next.js 15 |
| **Lenguaje** | TypeScript | ^5.3.0 | Tipado estático, mejor DX |
| **Frontend (Widget)** | Vanilla JavaScript | ES2020 | Sin dependencias, se inyecta en sitios externos |
| **Frontend (Dashboard)** | React 18 + Tailwind CSS 4 | ^18.3 / ^4.1 | UI del panel de administración |
| **Gráficos** | Recharts | ^3.6.0 | Visualización de métricas en dashboard |
| **IA** | FAL AI (Nano Banana Pro Edit) | @fal-ai/client ^1.8.1 | Modelo de virtual try-on |
| **Cache/Jobs** | Upstash Redis | @upstash/redis ^1.36.1 | Job store async, serverless-compatible |
| **Deployment** | Vercel | - | Edge functions, CDN global, auto-deploy |
| **CSS** | Tailwind CSS | ^4.1.18 | Utility-first para dashboard |

## Dependencias

### Producción (`dependencies`)

```json
{
  "@fal-ai/client": "^1.8.1",    // Cliente oficial de FAL AI
  "@upstash/redis": "^1.36.1",   // Redis serverless (Upstash)
  "next": "^15.0.0",             // Framework Next.js
  "react": "^18.3.0",            // React
  "react-dom": "^18.3.0",        // React DOM
  "recharts": "^3.6.0"           // Gráficos para dashboard
}
```

### Desarrollo (`devDependencies`)

```json
{
  "@tailwindcss/postcss": "^4.1.18",  // Plugin PostCSS para Tailwind v4
  "@types/node": "^20.0.0",           // Tipos de Node.js
  "@types/react": "^18.0.0",          // Tipos de React
  "@types/react-dom": "^18.0.0",      // Tipos de React DOM
  "autoprefixer": "^10.4.24",         // Autoprefixer CSS
  "postcss": "^8.5.6",                // PostCSS
  "tailwindcss": "^4.1.18",           // Tailwind CSS
  "typescript": "^5.3.0"              // TypeScript
}
```

## Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────┐
│                    SITIO WEB DEL CLIENTE                        │
│                                                                 │
│  <script src="https://tryon.vercel.app/api/widget"              │
│          data-tryon-key="client_api_key"></script>               │
│                                                                 │
│  ┌──────────────────────────────┐                               │
│  │   Widget (Shadow DOM)        │                               │
│  │   - FAB button               │                               │
│  │   - Upload panel             │                               │
│  │   - Result viewer            │                               │
│  └──────────┬───────────────────┘                               │
└─────────────┼───────────────────────────────────────────────────┘
              │ HTTPS (JSON)
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL (Next.js Backend)                     │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ /api/widget      │  │ /api/images/     │  │ /api/jobs/*   │  │
│  │ (Serve JS)       │  │   generate       │  │ (Async mode)  │  │
│  └─────────────────┘  │   upload         │  └───────┬───────┘  │
│                        └────────┬─────────┘          │          │
│  ┌─────────────────┐           │              ┌─────▼───────┐  │
│  │ /api/metrics     │           │              │ Upstash     │  │
│  │ /api/clients     │           │              │ Redis       │  │
│  │ /api/ingest      │           │              │ (Job Store) │  │
│  └─────────────────┘           │              └─────────────┘  │
│                                │                                │
│  ┌─────────────────┐           │                                │
│  │ /dashboard       │           │                                │
│  │ (Admin UI)       │           │                                │
│  └─────────────────┘           │                                │
└────────────────────────────────┼────────────────────────────────┘
                                 │ HTTPS
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FAL AI (Modelo de IA)                        │
│                                                                 │
│  Modelo: fal-ai/nano-banana-pro/edit                            │
│  Input: person_image + garment_image                            │
│  Output: imagen generada (URL CDN de FAL)                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Flujo de Datos

### Flujo principal: Generación de imagen

```
Usuario          Widget              Backend             FAL AI
  │                │                    │                   │
  ├─ Sube foto ──► │                    │                   │
  ├─ Sube prendas► │                    │                   │
  ├─ Click "Try" ► │                    │                   │
  │                ├─ Compress imgs ──► │                   │
  │                ├─ POST /generate ─► │                   │
  │                │                    ├─ Validate key ──► │
  │                │                    ├─ Call FAL API ───► │
  │                │                    │                   ├─ Inference
  │                │                    │                   │  (~5-8s)
  │                │                    │ ◄── Result URL ───┤
  │                │ ◄── JSON response ─┤                   │
  │ ◄── Muestra ───┤                    │                   │
  │    resultado    │                    │                   │
```

### Flujo alternativo: Modo asíncrono (Jobs)

```
Usuario          Widget              Backend             Redis        FAL AI
  │                │                    │                   │            │
  ├─ Click "Try" ► │                    │                   │            │
  │                ├─ POST /jobs/submit► │                   │            │
  │                │                    ├─ Create job ─────► │            │
  │                │ ◄── job_id ────────┤                   │            │
  │                │                    ├─ Fire & forget ──────────────► │
  │                ├─ Poll /status ────► │                   │            │
  │                │ ◄── "processing" ──┤                   │            │
  │                │     ...polling...  │                   │ ◄── done ──┤
  │                ├─ Poll /status ────► │                   │            │
  │                │ ◄── "done" + URL ──┤ ◄── Get job ─────┤            │
  │ ◄── Muestra ───┤                    │                   │            │
```

## Modelo de Negocio

### Esquema actual

- **API Keys por cliente**: Cada empresa cliente recibe un API key único que se coloca en el `<script>` tag del widget.
- **Tracking por key**: Cada generación se registra asociada al API key, permitiendo facturar por uso.
- **Sin facturación automática**: Actualmente el tracking es manual. Se cuentan generaciones por empresa para facturación offline.

### Costos operativos

| Concepto | Costo Estimado | Notas |
|---|---|---|
| FAL AI inference | ~$0.01-0.05/imagen | Depende del tier y modelo |
| Vercel hosting | $0-20/mes | Free tier generoso, Pro a $20/mes |
| Upstash Redis | $0-10/mes | Free tier: 10K comandos/día |
| **Total estimado** | ~$0.04/generación | Precio de costo |

### Monetización propuesta

- Cobrar a las empresas por generación (markup sobre el costo de FAL).
- Planes por volumen: Free (100 gens/mes), Pro (5000 gens/mes), Enterprise (ilimitado).
- El dashboard actual ya trackea generaciones por empresa, preparando el terreno para facturación.

---

> **Nota**: Este proyecto prioriza la simplicidad y rapidez de deployment sobre la robustez empresarial. No hay base de datos persistente (excepto Redis para jobs), no hay tests automatizados, no hay rate limiting. Todo esto es deuda técnica intencional documentada en [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md).
