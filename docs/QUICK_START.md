# 🚀 Inicio Rápido - TryOn API

## Pasos para iniciar el proyecto (AHORA)

### 1. Instalar dependencias

```powershell
npm install
```

Esto instalará:
- Next.js (framework web)
- Prisma (ORM para PostgreSQL)
- FAL AI SDK
- React y todas las dependencias necesarias

⏱️ Esto tomará **2-3 minutos**. Espera a que termine completamente.

### 2. Limpiar prepared statements de la base de datos

```powershell
node scripts/clear-prepared-statements.js
```

Esto eliminará prepared statements antiguos que causan el error 42P05.

### 3. Iniciar el servidor en modo desarrollo

```powershell
npm run dev
```

El servidor estará disponible en: **http://localhost:3000**

### 4. Verificar que funciona

Abre en tu navegador:
- http://localhost:3000 - Página principal
- http://localhost:3000/api/health - Health check
- http://localhost:3000/api/clients - Lista de clientes
- http://localhost:3000/dashboard - Panel de administración

---

## Comandos disponibles

### Desarrollo
```powershell
npm run dev              # Inicia servidor en modo desarrollo (hot reload)
```

### Producción
```powershell
npm run build            # Compila el proyecto para producción
npm run start            # Inicia servidor en modo producción
```

### Base de datos
```powershell
npm run clear-db         # Limpia prepared statements
npm run prisma:generate  # Regenera cliente Prisma
```

### Worker (procesamiento en background)
```powershell
npm run worker           # Inicia worker para procesar jobs
npm run worker:dev       # Inicia worker en modo desarrollo
```

---

## Solución de problemas comunes

### Error: "Cannot find module 'next'"
```powershell
# Reinstalar dependencias
rm -r node_modules
npm install
```

### Error: "prepared statement already exists" (42P05)
```powershell
# 1. Limpiar prepared statements
node scripts/clear-prepared-statements.js

# 2. Reiniciar servidor
# Ctrl+C para detener
npm run dev
```

### Error: "Prisma Client not generated"
```powershell
npm run prisma:generate
npm run dev
```

### El servidor no inicia
```powershell
# Verificar que el puerto 3000 esté libre
netstat -ano | findstr :3000

# Si está ocupado, matar el proceso:
taskkill /PID <PID> /F

# Luego reiniciar
npm run dev
```

---

## Estructura del proyecto

```
docs/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API endpoints
│   │   ├── dashboard/          # Dashboard admin
│   │   └── page.tsx            # Página principal
│   ├── lib/                    # Librerías y utilidades
│   │   ├── ai/                 # Integración FAL AI
│   │   ├── queue/              # BullMQ workers
│   │   └── db.ts               # Cliente Prisma
│   └── components/             # Componentes React
├── scripts/                    # Scripts de utilidad
├── .env                        # Variables de entorno
├── next.config.js              # Configuración Next.js
└── package.json                # Dependencias
```

---

## Variables de entorno importantes

Asegúrate de tener estas en tu `.env`:

```env
# Base de datos (CRÍTICO: incluir ?pgbouncer=true)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true"

# Prisma (CRÍTICO para evitar error 42P05)
PRISMA_DISABLE_PREPARED_STATEMENTS=1

# FAL AI
FAL_KEY="tu_api_key_aqui"

# Admin
ADMIN_PASSWORD="tu_password_aqui"
JWT_SECRET="tu_jwt_secret_aqui"
```

---

## Siguiente paso

Una vez que el servidor esté corriendo:
1. Ve a http://localhost:3000/dashboard
2. Login con usuario `admin` y tu ADMIN_PASSWORD
3. Crea un nuevo cliente para obtener una API key
4. Prueba la generación de imágenes

¿Problemas? Revisa `TROUBLESHOOTING.md`
