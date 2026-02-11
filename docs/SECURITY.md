# SECURITY - Seguridad del Sistema

## Tabla de Contenidos

- [Resumen de seguridad](#resumen-de-seguridad)
- [Mecanismos de autenticación](#mecanismos-de-autenticación)
- [CORS](#cors)
- [Content Security Policy (CSP)](#content-security-policy-csp)
- [Middleware de seguridad](#middleware-de-seguridad)
- [Gestión de secretos](#gestión-de-secretos)
- [Validación de entrada](#validación-de-entrada)
- [Vulnerabilidades conocidas](#vulnerabilidades-conocidas)
- [Rate limiting](#rate-limiting)
- [Recomendaciones de seguridad](#recomendaciones-de-seguridad)
- [Checklist de seguridad](#checklist-de-seguridad)

---

## Resumen de Seguridad

| Aspecto | Estado | Nivel |
|---|---|---|
| Autenticación API | ⚠️ Básica | Medio |
| Autenticación Admin | ⚠️ Básica | Bajo |
| CORS | ❌ Abierto (`*`) | Bajo |
| Rate Limiting | ❌ No implementado | Crítico |
| Input Validation | ⚠️ Parcial | Medio |
| HTTPS | ✅ Forzado por Vercel | Alto |
| Secrets Management | ✅ Env vars | Alto |
| CSP | ⚠️ Parcial | Medio |
| SQL Injection | ✅ N/A (sin SQL) | Alto |
| XSS | ⚠️ Shadow DOM mitiga | Medio |

---

## Mecanismos de Autenticación

### 1. API Key Authentication (Generación de imágenes)

**Archivo**: `lib/auth.ts`

**Método**: API key enviada en el body de la request.

**Implementación**:
```typescript
const clients: Record<string, ClientConfig> = {
  'demo_key_12345': { clientId: 'demo_client', company: 'Demo Client' },
  'demotryon01':    { clientId: 'demotryon01', company: 'Demo TryOn 01' },
  'testtryon01':    { clientId: 'testtryon01', company: 'Test TryOn 01' },
};

export function validateApiKey(apiKey: string): ClientConfig | null {
  return clients[apiKey] || null;
}
```

**Endpoints protegidos**:
- `POST /api/images/generate`
- `POST /api/images/upload`
- `POST /api/jobs/submit`

**Debilidades**:
- ⚠️ Claves hardcodeadas en el código fuente
- ⚠️ La API key viaja en el body (no en header)
- ⚠️ Sin rotación automática de claves
- ⚠️ Las empresas creadas dinámicamente vía `/api/clients` NO pueden autenticarse (no se registran en `auth.ts`)

### 2. Admin Key Authentication (Gestión)

**Método**: Clave admin como query parameter `key` o en el body.

**Implementación** (en cada endpoint):
```typescript
const adminKey = searchParams.get('key') || body.key;
if (adminKey !== process.env.ADMIN_KEY) {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
}
```

**Endpoints protegidos**:
- `GET /api/clients?key=...`
- `POST /api/clients` (key en body)
- `PUT /api/clients` (key en body)
- `DELETE /api/clients?key=...`
- `GET /api/metrics?key=...`

**Debilidades**:
- ⚠️ La clave viaja en la URL (query param) → visible en logs del servidor, historial del browser
- ⚠️ No hay expiración de la clave
- ⚠️ Una sola clave admin para todo

### 3. Cookie Session Authentication (Dashboard)

**Archivo**: `app/api/auth/login/route.ts` + `middleware.ts`

**Flujo**:
1. `POST /api/auth/login` con `{ password }` → valida contra `ADMIN_PASSWORD` env var
2. Si OK → setea cookie `admin_session=authenticated`
3. Middleware intercepta requests a `/dashboard/*` → verifica cookie

**Implementación del login**:
```typescript
const password = body.password;
const adminPassword = process.env.ADMIN_PASSWORD || 'tryon_admin_2024';

if (password === adminPassword) {
  const response = NextResponse.json({ success: true });
  response.cookies.set('admin_session', 'authenticated', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: 86400, // 24 horas
  });
  return response;
}
```

**Implementación del middleware**:
```typescript
if (pathname.startsWith('/dashboard')) {
  const session = request.cookies.get('admin_session');
  if (!session || session.value !== 'authenticated') {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

**Debilidades**:
- ⚠️ La cookie solo contiene `"authenticated"` → no identifica al usuario, no tiene token único
- ⚠️ Contraseña por defecto hardcodeada: `tryon_admin_2024`
- ⚠️ Sin CSRF protection
- ⚠️ Sin brute force protection
- ⚠️ Un solo nivel de admin (no hay roles)

---

## CORS

**Configuración actual**: TOTALMENTE ABIERTO

### En `middleware.ts` (Edge):
```typescript
response.headers.set('Access-Control-Allow-Origin', '*');
response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-api-key');
```

### En `next.config.js`:
```javascript
headers: [
  { key: 'Access-Control-Allow-Origin', value: '*' },
  // ...
]
```

### En `lib/cors.ts`:
Funciones helper que setean `Access-Control-Allow-Origin: *` en responses individuales.

**Justificación**: El widget se inyecta en sitios web de terceros (tiendas de ropa), por lo que necesita acceso cross-origin. Sin embargo, `*` permite acceso desde CUALQUIER dominio.

**Riesgo**: Cualquier sitio puede hacer requests a la API (incluyendo ataques de abuso).

**Recomendación**: Implementar lista blanca de dominios por cliente:
```typescript
const allowedOrigins = {
  'demo_client': ['https://tienda.com', 'https://staging.tienda.com'],
  // ...
};
```

---

## Content Security Policy (CSP)

Configurado en `next.config.js`:

```javascript
{
  key: 'Content-Security-Policy',
  value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https:; font-src 'self' data:; frame-src 'self';"
}
```

**Análisis**:
| Directiva | Valor | Riesgo |
|---|---|---|
| `script-src` | `'unsafe-inline' 'unsafe-eval'` | ⚠️ Alto - permite scripts inline y eval |
| `style-src` | `'unsafe-inline'` | ⚠️ Medio - permite estilos inline |
| `img-src` | `https:` | ✅ OK - permite imágenes de cualquier HTTPS |
| `connect-src` | `https:` | ⚠️ Medio - permite conexiones a cualquier HTTPS |

**Justificación**: El widget usa estilos inline (Shadow DOM) y el dashboard puede cargar imágenes de FAL CDN.

---

## Middleware de Seguridad

**Archivo**: `middleware.ts`

**Ejecución**: Edge Runtime (antes de llegar a los API routes)

**Funciones**:
1. **CORS preflight**: Maneja `OPTIONS` requests
2. **CORS headers**: Añade headers a todas las responses de `/api/*`
3. **Auth redirect**: Redirige `/dashboard/*` a `/login` si no hay cookie

**Matcher**:
```typescript
export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*'],
};
```

**Lo que NO hace**:
- ❌ Rate limiting
- ❌ IP blocking
- ❌ Request size limiting
- ❌ API key validation (se hace en cada endpoint individualmente)
- ❌ Logging de seguridad

---

## Gestión de Secretos

### Almacenamiento

| Secreto | Almacenamiento | Seguro |
|---|---|---|
| `FAL_KEY` | Vercel env vars | ✅ |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel env vars | ✅ |
| `ADMIN_KEY` | Vercel env vars | ✅ |
| `ADMIN_PASSWORD` | Vercel env vars (con default hardcodeado) | ⚠️ |
| API keys de clientes | Hardcodeadas en `lib/auth.ts` | ❌ |

### Exposición en el frontend

- Widget (`widget-core.js`): Contiene la API key del cliente embebida en la página HTML. Es visible en el código fuente del cliente. Esto es aceptable porque la API key identifica al cliente pero no otorga acceso admin.

### Rotación de secretos

**Estado actual**: No hay mecanismo de rotación automática.

**Proceso manual**:
1. Generar nueva clave
2. Actualizar en Vercel env vars
3. Redesplegar
4. Notificar a clientes (para API keys)

---

## Validación de Entrada

### Endpoints de generación

```typescript
// /api/images/generate
const { apiKey, userImage, garments } = await req.json();

// Validaciones:
if (!apiKey) → 401
if (!userImage) → 400
if (!garments || garments.filter(g => g).length === 0) → 400
```

**Lo que se valida**:
- ✅ Presencia de campos requeridos
- ✅ API key válida contra lista

**Lo que NO se valida**:
- ❌ Formato de imagen (MIME type)
- ❌ Tamaño de imagen (podría ser >100MB)
- ❌ Número máximo de garments
- ❌ Longitud de strings
- ❌ Contenido malicioso en imágenes
- ❌ Inyección en campos de texto

### Endpoints admin

```typescript
// /api/clients POST
const { name, website, key } = body;

// Solo valida:
if (key !== process.env.ADMIN_KEY) → 401
if (!name) → 400
```

**Lo que NO se valida**:
- ❌ Formato de URL del website
- ❌ Longitud del nombre
- ❌ Caracteres especiales
- ❌ Sanitización de strings

---

## Vulnerabilidades Conocidas

### 1. CRÍTICA: Sin Rate Limiting

**Impacto**: Un atacante puede hacer miles de llamadas a `/api/images/generate`, generando costos altos en FAL AI.
**Probabilidad**: Alta (endpoints públicos, sin CORS restrictivo).
**Mitigación**: Implementar `@upstash/ratelimit`.

### 2. ALTA: CORS abierto (`*`)

**Impacto**: Cualquier sitio web puede usar la API.
**Probabilidad**: Media.
**Mitigación**: Lista blanca de dominios por cliente.

### 3. ALTA: Contraseña admin por defecto

**Impacto**: Si `ADMIN_PASSWORD` no se configura, la contraseña es `tryon_admin_2024`.
**Probabilidad**: Media-alta (puede olvidarse configurar).
**Mitigación**: Eliminar default, requerir env var.

### 4. MEDIA: API keys en código fuente

**Impacto**: Las claves están versionadas en Git.
**Probabilidad**: Baja (requiere acceso al repo).
**Mitigación**: Mover a base de datos o env vars.

### 5. MEDIA: Cookie de sesión no segura

**Impacto**: Cookie falsificable (valor fijo `"authenticated"`).
**Probabilidad**: Baja (requiere interceptar headers).
**Mitigación**: Usar JWT con firma, o sesiones en Redis.

### 6. MEDIA: Admin key en query params

**Impacto**: Clave visible en logs de servidor, historial, referrers.
**Probabilidad**: Media.
**Mitigación**: Mover a header `Authorization: Bearer <key>`.

### 7. BAJA: Sin validación de tamaño de request

**Impacto**: Se pueden enviar imágenes enormes (DoS potencial).
**Probabilidad**: Baja (Vercel tiene límites propios: 4.5MB body).
**Nota**: Vercel limita el body a 4.5MB en Serverless Functions.

### 8. BAJA: Sin sanitización de nombres de empresa

**Impacto**: XSS potencial en el dashboard admin.
**Probabilidad**: Baja (requiere acceso admin).
**Mitigación**: React escapa por defecto, pero validar input.

---

## Rate Limiting

### Estado Actual: NO IMPLEMENTADO

### Implementación Recomendada

```typescript
// lib/ratelimit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// Rate limiting por API key
export const apiKeyRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"), // 10 req/min
  prefix: "ratelimit:api",
});

// Rate limiting por IP (para endpoints públicos)
export const ipRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "60 s"), // 30 req/min
  prefix: "ratelimit:ip",
});

// Rate limiting para login (anti brute force)
export const loginRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(5, "15 m"), // 5 intentos / 15 min
  prefix: "ratelimit:login",
});
```

**Uso en endpoints**:
```typescript
// En /api/images/generate
const { success, remaining } = await apiKeyRatelimit.limit(apiKey);
if (!success) {
  return NextResponse.json(
    { error: "Rate limit exceeded", retryAfter: 60 },
    { status: 429 }
  );
}
```

### Límites Recomendados

| Endpoint | Límite | Ventana |
|---|---|---|
| `/api/images/generate` | 10 req | 60s (por API key) |
| `/api/images/upload` | 20 req | 60s (por API key) |
| `/api/jobs/submit` | 10 req | 60s (por API key) |
| `/api/auth/login` | 5 req | 15 min (por IP) |
| `/api/widget` | 100 req | 60s (por IP) |
| `/api/ingest` | 50 req | 60s (por IP) |

---

## Recomendaciones de Seguridad

### Prioridad Alta (Implementar ya)

1. **Rate Limiting**: Usar `@upstash/ratelimit` (ya tienen Upstash Redis).
2. **Mover API keys a Redis/DB**: Salir de hardcoded, permitir rotación.
3. **Restringir CORS**: Lista blanca de dominios por cliente registrado.
4. **Eliminar default de ADMIN_PASSWORD**: Forzar configuración por env var.

### Prioridad Media

5. **JWT para sesiones admin**: Reemplazar cookie `"authenticated"` con JWT firmado.
6. **Mover admin key a header**: `Authorization: Bearer <key>` en vez de query param.
7. **Validación de input robusta**: Usar Zod para schemas de request.
8. **Logging de seguridad**: Registrar intentos fallidos de auth.

### Prioridad Baja

9. **Validación de imágenes**: Verificar MIME type y tamaño antes de procesar.
10. **CSRF tokens**: Para formularios del dashboard.
11. **Helmet headers**: Agregar más headers de seguridad.
12. **Audit logging**: Registrar acciones admin con timestamp y origin.

---

## Checklist de Seguridad

### Pre-Producción

- [ ] `ADMIN_PASSWORD` configurada (no usar default)
- [ ] `ADMIN_KEY` configurada y diferente al default
- [ ] `FAL_KEY` configurada
- [ ] Variables de entorno NO commiteadas en Git
- [ ] `.env.local` en `.gitignore`
- [ ] Verificar que `demo_key_12345` no se use en producción
- [ ] HTTPS forzado (Vercel lo hace automáticamente)

### Pre-Launch con Clientes

- [ ] Rate limiting implementado
- [ ] CORS restringido a dominios del cliente
- [ ] API key única generada para el cliente
- [ ] Documentar al cliente que la API key es visible en frontend
- [ ] Monitoreo de uso configurado

### Mantenimiento

- [ ] Rotar API keys cada 90 días
- [ ] Revisar logs de acceso mensualmente
- [ ] Actualizar dependencias (npm audit)
- [ ] Verificar que no hay secretos en commits

---

> **Referencias**: Ver [DEPLOYMENT.md](DEPLOYMENT.md) para configuración de variables de entorno, y [API_REFERENCE.md](API_REFERENCE.md) para detalles de autenticación por endpoint.
