# DEPENDENCIES - Dependencias del Proyecto

## Tabla de Contenidos

- [Resumen de dependencias](#resumen-de-dependencias)
- [Dependencias de producción](#dependencias-de-producción)
- [Dependencias de desarrollo](#dependencias-de-desarrollo)
- [Scripts npm](#scripts-npm)
- [Node.js y runtime](#nodejs-y-runtime)
- [Dependencias implícitas](#dependencias-implícitas)
- [Auditoría de seguridad](#auditoría-de-seguridad)
- [Actualización de dependencias](#actualización-de-dependencias)
- [Alternativas evaluadas](#alternativas-evaluadas)

---

## Resumen de Dependencias

| Categoría | Cantidad | Críticas |
|---|---|---|
| Producción | 8 | Next.js, React, FAL, Upstash Redis |
| Desarrollo | 5 | TypeScript, ESLint, Tailwind |
| **Total** | **13** | - |

> **Filosofía**: El proyecto mantiene un número mínimo de dependencias. El widget (`widget-core.js`) es **zero-dependency** (Vanilla JS puro).

---

## Dependencias de Producción

### 1. `next` — Framework principal

| Aspecto | Detalle |
|---|---|
| **Versión** | `^15.0.0` |
| **Propósito** | Framework fullstack: SSR, API routes, middleware, routing |
| **Por qué** | Combina frontend (React) y backend (API routes) en un solo proyecto |
| **Usado en** | Todo el proyecto: pages, API routes, middleware |
| **Alternativas** | Express.js + React separados, Remix, Nuxt.js (Vue) |
| **Tamaño** | ~20MB (node_modules) |
| **Licencia** | MIT |

**Funcionalidades de Next.js usadas:**
- App Router (`app/` directory)
- API Routes (`route.ts` files)
- Edge Middleware (`middleware.ts`)
- Static file serving (`public/`)
- CSS modules (Tailwind via PostCSS)
- `maxDuration` config para serverless
- `dynamic = 'force-dynamic'` para evitar caching

---

### 2. `react` — UI library

| Aspecto | Detalle |
|---|---|
| **Versión** | `^18.3.0` |
| **Propósito** | Renderizado de componentes del dashboard |
| **Usado en** | Dashboard pages, componentes en `components/` |
| **Nota** | Solo para el dashboard admin. El widget NO usa React |

---

### 3. `react-dom` — React DOM renderer

| Aspecto | Detalle |
|---|---|
| **Versión** | `^18.3.0` |
| **Propósito** | Renderizado de React en el browser (DOM) |
| **Nota** | Requerido por React, siempre va junto |

---

### 4. `@fal-ai/client` — SDK de FAL AI

| Aspecto | Detalle |
|---|---|
| **Versión** | `^1.8.1` |
| **Propósito** | Comunicación con la API de FAL AI para inferencia de modelos |
| **Usado en** | `lib/fal-client.ts`, `lib/fal-async.ts` |
| **Por qué** | SDK oficial de FAL con tipado TypeScript, manejo de subscriptions/polling |
| **Funcionalidades usadas** | `fal.config()`, `fal.subscribe()`, `fal.storage.upload()` |
| **Alternativa** | HTTP directo con `fetch` (más código, menos features) |
| **Licencia** | MIT |

**Configuración:**
```typescript
import { fal } from '@fal-ai/client';
fal.config({ credentials: process.env.FAL_KEY });
```

**Modelo usado:** `fal-ai/nano-banana-pro/edit`

---

### 5. `@upstash/redis` — Cliente Redis serverless

| Aspecto | Detalle |
|---|---|
| **Versión** | `^1.36.1` |
| **Propósito** | Storage de jobs async, respaldo de métricas |
| **Usado en** | `lib/redis.ts`, `lib/job-store.ts`, `lib/metrics-store.ts` |
| **Por qué** | Redis serverless via HTTP (no requiere conexión TCP persistente) |
| **Funcionalidades usadas** | `set`, `get`, `del` con TTL |
| **Alternativa** | `ioredis` (requiere TCP), Vercel KV (wrapper de Upstash) |
| **Licencia** | MIT |

**Ventaja clave:** Funciona en Serverless Functions de Vercel donde las conexiones TCP no persisten.

**Configuración:**
```typescript
import { Redis } from '@upstash/redis';
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
```

---

### 6. `recharts` — Librería de gráficos

| Aspecto | Detalle |
|---|---|
| **Versión** | `^3.6.0` |
| **Propósito** | Gráficos en el dashboard de analytics |
| **Usado en** | `app/dashboard/analytics/page.tsx` |
| **Por qué** | Basado en React, fácil de usar, buena documentación |
| **Tipos de gráficos usados** | `LineChart`, `PieChart`, `BarChart` |
| **Componentes importados** | `ResponsiveContainer`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`, `Pie`, `Cell`, `Bar` |
| **Alternativa** | Chart.js, D3.js, Nivo |
| **Tamaño** | ~500KB |
| **Licencia** | MIT |

---

### 7. `lucide-react` — Iconos

| Aspecto | Detalle |
|---|---|
| **Versión** | `^0.511.0` |
| **Propósito** | Iconos SVG para el dashboard |
| **Usado en** | Dashboard pages, componentes |
| **Por qué** | Tree-shakeable (solo importa iconos usados), estilo consistente |
| **Iconos usados** | `Download`, `RefreshCw`, `TrendingUp`, `BarChart2`, `Users`, `Activity`, etc. |
| **Alternativa** | Heroicons, FontAwesome, react-icons |
| **Licencia** | ISC |

---

### 8. `date-fns` — Utilidades de fechas

| Aspecto | Detalle |
|---|---|
| **Versión** | `^4.1.0` |
| **Propósito** | Formateo y manipulación de fechas en el dashboard |
| **Usado en** | `lib/metrics-store.ts`, páginas de analytics |
| **Por qué** | Modular (tree-shakeable), inmutable, ligero |
| **Funciones usadas** | `format`, `subDays`, `subHours`, `startOfDay`, `parseISO` |
| **Alternativa** | Day.js, Moment.js (deprecated), Temporal API (futuro) |
| **Licencia** | MIT |

---

## Dependencias de Desarrollo

### 9. `typescript` — Lenguaje

| Aspecto | Detalle |
|---|---|
| **Versión** | `^5.3.0` |
| **Propósito** | Type safety en el backend y dashboard |
| **Config** | `strict: true`, target ES2017, module ESNext |
| **Nota** | `widget-core.js` es JavaScript puro (no TypeScript) |

---

### 10. `@types/react` — Tipos de React

| Aspecto | Detalle |
|---|---|
| **Versión** | `^18.3.0` |
| **Propósito** | Definiciones de tipos para React |

---

### 11. `@types/node` — Tipos de Node.js

| Aspecto | Detalle |
|---|---|
| **Versión** | `^20.0.0` |
| **Propósito** | Definiciones de tipos para APIs de Node.js (`fs`, `path`, `https`, etc.) |

---

### 12. `tailwindcss` — Framework CSS

| Aspecto | Detalle |
|---|---|
| **Versión** | `^4.1.18` |
| **Propósito** | Utility-first CSS para el dashboard |
| **Usado en** | Todas las páginas y componentes del dashboard |
| **Config** | `tailwind.config.js` |
| **Nota** | Solo para el dashboard. El widget tiene sus propios estilos inline |
| **Licencia** | MIT |

---

### 13. `eslint` + configs — Linting

| Aspecto | Detalle |
|---|---|
| **Incluido vía** | `eslint-config-next` (parte de Next.js) |
| **Propósito** | Verificación de calidad de código |
| **Comando** | `npm run lint` |

---

## Scripts npm

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

| Script | Comando | Descripción |
|---|---|---|
| `dev` | `next dev` | Servidor de desarrollo con hot reload (port 3000) |
| `build` | `next build` | Compilación para producción |
| `start` | `next start` | Servidor de producción (requiere build previo) |
| `lint` | `next lint` | ESLint sobre el proyecto |

---

## Node.js y Runtime

| Requisito | Versión |
|---|---|
| **Node.js** | ≥18.0.0 |
| **npm** | ≥8.0.0 |
| **Runtime Vercel** | Node.js 18.x o 20.x |

### APIs de Node.js usadas directamente

| API | Usado en | Para qué |
|---|---|---|
| `fs.readFileSync` | `app/api/widget/route.ts` | Leer `widget-core.js` |
| `fs.writeFileSync` | `lib/metrics-store.ts` | Persistir métricas a disco |
| `fs.readFileSync` | `lib/metrics-store.ts` | Cargar métricas desde disco |
| `https.Agent` | `lib/http-agent.ts` | Keep-alive agent |
| `path.join` | Varios | Resolver rutas de archivos |
| `Buffer` | `app/api/images/upload/route.ts` | Convertir base64 a binary |
| `crypto` | (implícito en @fal-ai) | Hashing interno |

---

## Dependencias Implícitas

Estas librerías vienen incluidas con Next.js y no se declaran en `package.json`:

| Librería | Versión (approx) | Usada para |
|---|---|---|
| `webpack` | 5.x | Bundling (interno de Next.js) |
| `SWC` | - | Compilación TypeScript (interno de Next.js) |
| `postcss` | 8.x | Procesamiento CSS |
| `autoprefixer` | 10.x | Prefijos CSS automáticos |

---

## Auditoría de Seguridad

```bash
# Ejecutar auditoría
npm audit

# Corregir vulnerabilidades automáticamente
npm audit fix

# Solo corregir las que no tienen breaking changes
npm audit fix --force  # ⚠️ puede romper cosas
```

### Recomendaciones

- Ejecutar `npm audit` mensualmente
- Mantener Node.js actualizado (al menos LTS)
- Actualizar dependencias menores regularmente
- Probar actualizaciones mayores en rama separada

---

## Actualización de Dependencias

### Verificar versiones disponibles

```bash
# Ver qué se puede actualizar
npm outdated

# Actualizar dentro del rango de semver
npm update

# Actualizar a la última versión (puede tener breaking changes)
npx npm-check-updates -u
npm install
```

### Notas de actualización por dependencia

| Dependencia | Actualización segura | Notas |
|---|---|---|
| `next` | Minor OK | Majors requieren revision de breaking changes |
| `react` | 18.x → 18.x OK | React 19 tiene cambios significativos |
| `@fal-ai/client` | Minor OK | Verificar compatibilidad de modelos |
| `@upstash/redis` | Minor OK | API stable |
| `recharts` | Minor OK | v3 tiene cambios vs v2 |
| `typescript` | Minor OK | Majors pueden requerir ajustes de tipos |
| `tailwindcss` | v4 → v4 OK | v3→v4 fue major migration |

---

## Alternativas Evaluadas

### Framework

| Opción | Por qué no se eligió |
|---|---|
| **Express.js** | Requiere configurar SSR separado, más setup |
| **Fastify** | No tiene SSR integrado |
| **Remix** | Menos maduro, menor ecosistema |
| **Hono** | Demasiado nuevo, sin SSR |
| **Nest.js** | Overkill para este tamaño de proyecto |

### Base de datos

| Opción | Por qué no se eligió |
|---|---|
| **PostgreSQL directo** | Requiere hosting, conexión TCP |
| **MongoDB** | Overkill, no relacional |
| **SQLite** | No funciona en serverless de Vercel |
| **Vercel KV** | Es wrapper de Upstash (se usa Upstash directo) |

### AI Provider

| Opción | Por qué no se eligió |
|---|---|
| **Replicate** | Latencia mayor, pricing por segundo |
| **Banana.dev** | API menos madura, stub implementado |
| **RunPod** | Requiere más configuración |
| **HuggingFace** | Inferencia más lenta en free tier |

### Widget Framework

| Opción | Por qué no se eligió |
|---|---|
| **Preact** | Añadiría dependencia, aumentaría bundle |
| **Lit** | Requiere build step |
| **Svelte** | Requiere build step |
| **Web Components (estándar)** | Se usa Shadow DOM pero sin custom elements formales |

---

> **Referencias**: Ver [FILE_STRUCTURE.md](FILE_STRUCTURE.md) para dónde se usa cada dependencia, y [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) para dependencias futuras recomendadas.
