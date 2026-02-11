# Troubleshooting Guide

## Error 42P05: "prepared statement already exists"

### Síntomas
- Requests a API devuelven 500
- Logs muestran: `PostgresError { code: "42P05", message: "prepared statement \"s0\" already exists" }`
- Ocurre especialmente con Supabase Connection Pooler

### Causa
PostgreSQL con PgBouncer (usado por Supabase) reutiliza conexiones que pueden mantener prepared statements entre sesiones, causando conflictos cuando Prisma intenta crear nuevos prepared statements con el mismo nombre.

### Solución (3 pasos)

#### 1. Añadir `?pgbouncer=true` a DATABASE_URL

En tu archivo `.env`, asegúrate de que DATABASE_URL incluya `?pgbouncer=true` al final:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true"
```

#### 2. Verificar PRISMA_DISABLE_PREPARED_STATEMENTS

En `.env`, debe estar presente:

```env
PRISMA_DISABLE_PREPARED_STATEMENTS=1
```

#### 3. Reiniciar completamente

**Opción A - Reinicio limpio (recomendado):**

```powershell
# 1. Detener el servidor (Ctrl+C)
# 2. Limpiar prepared statements existentes
node scripts/clear-prepared-statements.js

# 3. Reiniciar el servidor
npm run start
```

**Opción B - Reinicio simple:**

```powershell
# 1. Detener el servidor (Ctrl+C)
# 2. Reiniciar
npm run start
```

**Opción C - Si sigues teniendo problemas:**

1. Reinicia la base de datos desde Supabase Dashboard (Settings > Database > Restart)
2. Espera 1-2 minutos
3. Reinicia tu servidor Node

### Verificación

Después de reiniciar, deberías ver en los logs:

```
[Prisma] PRISMA_DISABLE_PREPARED_STATEMENTS already set to: 1
[Prisma] DATABASE_URL contains pgbouncer=true: true
[Prisma] Client initialized
```

Y las requests a la API deberían funcionar:

```bash
# Debería devolver 200
curl http://localhost:3000/api/clients
```

### Prevención

- **SIEMPRE** usa `?pgbouncer=true` en DATABASE_URL cuando uses Supabase Connection Pooler (puerto 6543)
- **SIEMPRE** setea `PRISMA_DISABLE_PREPARED_STATEMENTS=1` en `.env`
- No cambies entre conexión directa (puerto 5432) y pooler (puerto 6543) sin reiniciar completamente

### Referencias

- [Prisma + PgBouncer Configuration](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management/configure-pg-bouncer)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)

---

## Otros errores comunes

### Error: "Invalid API key"
- Verifica que el `x-api-key` header esté presente en el request
- Verifica que el API key exista en la tabla `Client`

### Error: "Origin not allowed"
- Añade el dominio del frontend a `AllowedDomain` para ese cliente
- O temporalmente configura `allowedDomains: ['*']` en middleware para testing

### Error: "Generation limit reached"
- El cliente ha alcanzado su límite de generaciones
- Incrementa el campo `limit` en la tabla `Client`
