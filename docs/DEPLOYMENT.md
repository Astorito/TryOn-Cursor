# DEPLOYMENT - Guía de Despliegue

## Tabla de Contenidos

- [Plataforma actual: Vercel](#plataforma-actual-vercel)
- [Variables de entorno](#variables-de-entorno)
- [Configuración del proyecto](#configuración-del-proyecto)
- [Despliegue paso a paso](#despliegue-paso-a-paso)
- [Desarrollo local](#desarrollo-local)
- [CI/CD](#cicd)
- [Monitoreo en producción](#monitoreo-en-producción)
- [Costos estimados](#costos-estimados)
- [Plataformas alternativas](#plataformas-alternativas)
- [Rollback y recuperación](#rollback-y-recuperación)

---

## Plataforma Actual: Vercel

| Aspecto | Detalle |
|---|---|
| **Plataforma** | Vercel |
| **Framework** | Next.js 15 |
| **Runtime** | Node.js 18+ (Serverless Functions) |
| **Edge** | Middleware ejecutado en Edge Runtime |
| **CDN** | Vercel Edge Network (global) |
| **Dominio** | Custom o `*.vercel.app` |
| **Branch deploy** | Automático por PR |

### Límites de Vercel por Plan

| Límite | Free (Hobby) | Pro |
|---|---|---|
| Serverless timeout | 10s | 60s |
| Edge timeout | 30s | 30s |
| Bandwidth | 100GB/mes | 1TB/mes |
| Serverless exec | 100h/mes | 1000h/mes |
| Build time | 6000 min/mes | 24000 min/mes |
| Concurrent builds | 1 | 12 |

> **Importante**: El endpoint `/api/images/generate` tiene `maxDuration = 60`, lo que requiere Vercel Pro. En Free tier, la función tendrá timeout a los 10s.

---

## Variables de Entorno

### Requeridas para funcionamiento

| Variable | Valor de ejemplo | Descripción |
|---|---|---|
| `FAL_KEY` | `fal_key_abc123...` | API key de FAL AI (principal) |
| `FAL_API_KEY` | `fal_key_abc123...` | API key de FAL AI (fallback, se usa si FAL_KEY no existe) |

### Requeridas para async jobs

| Variable | Valor de ejemplo | Descripción |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | `https://us1-xxx.upstash.io` | URL REST de Upstash Redis |
| `UPSTASH_REDIS_REST_TOKEN` | `AXxx...` | Token de autenticación de Upstash |

### Requeridas para dashboard admin

| Variable | Valor de ejemplo | Descripción |
|---|---|---|
| `ADMIN_KEY` | `my_secret_admin_key` | Clave para endpoints de administración |
| `ADMIN_PASSWORD` | `tryon_admin_2024` | Contraseña de login del dashboard |

### Opcionales

| Variable | Default | Descripción |
|---|---|---|
| `METRICS_ENDPOINT` | `` | URL externa para envío de métricas |
| `BANANA_PRO_API_KEY` | `` | API key de Banana.dev (no implementado) |
| `BANANA_PRO_API_URL` | `https://api.banana.dev/v4/inference` | URL de Banana.dev |
| `NODE_ENV` | `development` | Entorno (`development`/`production`) |

### Configurar en Vercel

```bash
# CLI de Vercel
vercel env add FAL_KEY production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add ADMIN_KEY production
vercel env add ADMIN_PASSWORD production
```

O desde el dashboard de Vercel: Settings → Environment Variables.

---

## Configuración del Proyecto

### `next.config.js`

```javascript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With, x-api-key' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; ..." },
        ],
      },
    ];
  },
};
```

### `vercel.json`

```json
{
  "x-vercel-protection-bypass": "auto"
}
```

> **Nota**: `x-vercel-protection-bypass` desactiva la protección de autenticación de Vercel para permitir acceso público a la API. Esto es necesario porque el widget se inyecta en sitios de terceros.

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

---

## Despliegue Paso a Paso

### 1. Prerequisitos

- Cuenta en [Vercel](https://vercel.com)
- Cuenta en [FAL AI](https://fal.ai) con API key
- (Opcional) Cuenta en [Upstash](https://upstash.com) para Redis

### 2. Clonar y configurar

```bash
git clone <repo-url>
cd Tryon-Backend-definitivo

# Instalar dependencias
npm install
```

### 3. Configurar variables de entorno locales

```bash
# Crear archivo .env.local
cat <<EOF > .env.local
FAL_KEY=fal_key_your_key_here
UPSTASH_REDIS_REST_URL=https://us1-xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx_your_token_here
ADMIN_KEY=your_admin_key
ADMIN_PASSWORD=your_admin_password
EOF
```

### 4. Verificar localmente

```bash
npm run dev
# Acceder a http://localhost:3000
# Probar health: curl http://localhost:3000/api/health
# Probar widget: abrir http://localhost:3000/demo.html
```

### 5. Desplegar a Vercel

```bash
# Opción A: CLI
npm i -g vercel
vercel login
vercel

# Opción B: Git push (si ya está conectado)
git push origin main
```

### 6. Configurar variables de entorno en Vercel

Desde el dashboard de Vercel o CLI:
```bash
vercel env add FAL_KEY production
# ... repetir para cada variable
```

### 7. Redesplegar con variables

```bash
vercel --prod
```

### 8. Verificar despliegue

```bash
curl https://tu-app.vercel.app/api/health
# Debe retornar: {"status":"healthy",...}
```

---

## Desarrollo Local

### Comandos disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia servidor de desarrollo con hot reload (Next.js) |
| `npm run build` | Compila el proyecto para producción |
| `npm run start` | Inicia servidor de producción (post-build) |
| `npm run lint` | Ejecuta ESLint |

### Puerto por defecto

```
http://localhost:3000
```

### Páginas de prueba disponibles

| URL | Descripción |
|---|---|
| `/demo.html` | Demo interactiva del widget |
| `/test-widget.html` | Prueba del widget con configuración |
| `/test-async.html` | Prueba del flujo asíncrono |
| `/diagnostico.html` | Herramienta de diagnóstico |

### Hot Reload

Next.js 15 incluye Fast Refresh que recarga automáticamente cambios en:
- Componentes React (`.tsx`, `.jsx`)
- API routes (`.ts` en `app/api/`)
- Estilos (`.css`)

> **Excepción**: Cambios en `lib/widget-core.js` NO se reflejan automáticamente. El endpoint `/api/widget` usa `readFileSync` con el contenido en memoria. Reinicia el servidor de desarrollo.

---

## CI/CD

### Pipeline actual

El proyecto NO tiene CI/CD configurado explícitamente. Vercel proporciona:

1. **Deploy automático en push a `main`** → Producción
2. **Preview deploys en PRs** → URL temporal por PR
3. **Build automático** → `next build`
4. **Checks** → Build success/failure

### Pipeline recomendado

```yaml
# .github/workflows/ci.yml (propuesta)
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      # Cuando se implemente testing:
      # - run: npm test
```

---

## Monitoreo en Producción

### Herramientas disponibles

| Herramienta | Propósito | Acceso |
|---|---|---|
| **Vercel Dashboard** | Logs, deploys, analytics | vercel.com/dashboard |
| **Dashboard propio** | Métricas de uso, empresas | `/dashboard` |
| **Health endpoint** | Verificar estado | `GET /api/health` |
| **Jobs health** | Verificar Redis | `GET /api/jobs/health` |

### Alertas recomendadas

| Alerta | Trigger | Acción |
|---|---|---|
| Health check falla | `GET /api/health` retorna ≠200 | Verificar Vercel status |
| Redis desconectado | `GET /api/jobs/health` retorna error | Verificar Upstash |
| Alta latencia | `timings.total_backend_ms > 15000` | Verificar FAL status |
| Error rate alto | `>10% errores en 5 min` | Revisar logs |

### Logs

- **Vercel Logs**: Dashboard → Functions → Logs en tiempo real
- **Structured logging**: El sistema emite logs JSON estructurados para métricas:

```json
{
  "type": "GENERATION_TIMING",
  "requestId": "gen_xxx",
  "total_backend_ms": 6200,
  "fal_duration_ms": 5800,
  "cold_start": false
}
```

---

## Costos Estimados

### Vercel

| Plan | Costo | Límites relevantes |
|---|---|---|
| Hobby (Free) | $0/mes | 10s timeout (insuficiente), 100GB bw |
| Pro | $20/mes | 60s timeout, 1TB bw |
| Enterprise | Custom | Sin límites |

### FAL AI

| Concepto | Costo estimado |
|---|---|
| Por inferencia | ~$0.01-0.05 |
| 1000 generaciones/mes | ~$10-50 |
| 10000 generaciones/mes | ~$100-500 |

### Upstash Redis

| Plan | Costo | Límites |
|---|---|---|
| Free | $0/mes | 10,000 commands/day |
| Pay-as-you-go | $0.2/100K commands | Sin límite |
| Pro | $10/mes | 500K commands/day |

### Costo total estimado (1000 gen/mes)

| Componente | Costo |
|---|---|
| Vercel Pro | $20 |
| FAL AI | ~$30 |
| Upstash Redis | $0 (free tier) |
| **Total** | **~$50/mes** |

---

## Plataformas Alternativas

### AWS (Lambda + API Gateway)

```
Pros: Control total, escalabilidad, ecosistema amplio
Cons: Más complejo, cold starts más largos
Costo: Variable (~$10-100/mes)
Cambios necesarios:
  - Adaptar API routes a Lambda handlers
  - Usar SAM o Serverless Framework
  - Configurar API Gateway manualmente
  - Configurar CloudFront para CDN
```

### Railway

```
Pros: Simple, deploys automáticos, containers
Cons: Sin edge functions, sin CDN propio
Costo: ~$5-20/mes
Cambios necesarios:
  - Agregar Dockerfile o usar buildpack
  - Configurar PORT env var
  - Cambiar `next start` como start command
```

### Fly.io

```
Pros: Containers edge, buen pricing, WebSockets
Cons: Más setup, sin integration con Next.js
Costo: ~$5-15/mes
Cambios necesarios:
  - Crear Dockerfile
  - Configurar fly.toml
  - Ajustar health checks
```

### Docker (Self-hosted)

```dockerfile
# Dockerfile propuesto
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Rollback y Recuperación

### Rollback en Vercel

```bash
# Ver deploys anteriores
vercel ls

# Promover un deploy anterior a producción
vercel promote <deployment-url>
```

O desde el dashboard: Deployments → Click en deploy anterior → "Promote to Production".

### Recuperación de datos

| Dato | Ubicación | Recuperable |
|---|---|---|
| Métricas | `temp/metrics.json` + memoria | Se pierde en redeploy |
| Jobs async | Redis (TTL 1h) | Se pierden después de 1h |
| Empresas dinámicas | Memoria (Map) | Se pierden en redeploy |
| Empresas hardcoded | `lib/auth.ts` | Siempre disponibles |
| Widget JS | `lib/widget-core.js` | Siempre disponible (git) |

### Estrategia de backup recomendada

```bash
# Backup periódico de métricas (si se implementa persistencia)
curl "https://api.example.com/api/metrics?key=ADMIN_KEY" > backup_metrics_$(date +%Y%m%d).json
```

---

> **Referencias**: Ver [SECURITY.md](SECURITY.md) para configuración segura de variables de entorno, y [ARCHITECTURE.md](ARCHITECTURE.md) para la arquitectura del sistema.
