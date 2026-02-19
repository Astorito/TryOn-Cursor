# Dashboard Financiero - Instrucciones de Configuración

## ✅ Componentes Creados

He creado un dashboard financiero completo con las siguientes características:

### 📁 Archivos Creados

1. **Esquema de Base de Datos** - `/prisma/schema.prisma`
   - Agregados campos: `tier`, `credits`, `creditsUsed`, `lastPurchaseDate`, `monthlyRevenue`

2. **API Endpoint** - `/app/api/dashboard/financial/route.ts`
   - Endpoint que calcula todos los KPIs y datos financieros en tiempo real
   - URL: `GET /api/dashboard/financial?timeRange=7d`

3. **Página del Dashboard** - `/app/dashboard/analytics/financiero/page.tsx`
   - Dashboard completo con todos los componentes visuales solicitados
   - Conectado al API endpoint para datos en tiempo real

4. **Script de Datos de Ejemplo** - `/scripts/seed-financial-data.ts`
   - Script para poblar la base de datos con datos de ejemplo

5. **Botón de Acceso** - Actualizado `/app/dashboard/analytics/page.tsx`
   - Agregado botón "Dashboard Financiero" en la página de analytics

## 🚀 Pasos para Completar la Configuración

### 1. Aplicar Cambios a la Base de Datos

⚠️ **IMPORTANTE**: Los errores de TypeScript en el código se resolverán automáticamente después de aplicar estos cambios.

Ejecuta uno de estos comandos para actualizar la base de datos:

```bash
# Opción 1: Push directo (recomendado - más rápido)
npx prisma db push

# Luego regenera el cliente de Prisma
npx prisma generate
```

**Si hay problemas con la conexión**, aplica estos cambios manualmente:

1. Ve a tu dashboard de Supabase: https://app.supabase.com
2. Selecciona tu proyecto
3. Ve a "SQL Editor"
4. Ejecuta el siguiente SQL:

```sql
-- Agregar campos financieros a la tabla Client
ALTER TABLE "Client" 
ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN IF NOT EXISTS "credits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "creditsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lastPurchaseDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "monthlyRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Crear índice para tier
CREATE INDEX IF NOT EXISTS "Client_tier_idx" ON "Client"("tier");
```

5. Después de ejecutar el SQL, regenera el cliente de Prisma:

```bash
npx prisma generate
```

### 2. Poblar con Datos de Ejemplo

Ejecuta el script para agregar datos de ejemplo:

```bash
npx ts-node scripts/seed-financial-data.ts
```

Este script creará/actualizará clientes con información de:
- TechCorp Global (Enterprise)
- Innovate AI (Professional)
- DataSphere Systems (Enterprise) - con créditos bajos
- FutureSoft Inc (Starter)

### 3. Iniciar el Servidor

```bash
npm run dev
```

### 4. Acceder al Dashboard

1. Abre el navegador en `http://localhost:3000`
2. Navega a **Dashboard** → **Analíticas**
3. Haz clic en el botón **"💰 Dashboard Financiero"**

O accede directamente a: `http://localhost:3000/dashboard/analytics/financiero`

## 📊 Características del Dashboard

### KPIs Principales
- **Usuarios Activos**: Contador con % de cambio vs mes anterior
- **Llamadas API**: Total de generaciones con capacidad
- **Ingresos Licencia**: Suma de ingresos por suscripciones
- **Venta de Créditos**: Calculado desde créditos × costo por token

### Panel de Uso por Empresa
- Ranking de clientes ordenado por generaciones
- Barras de progreso (rojas si créditos < 20%)
- Alertas visuales para clientes con créditos bajos
- Muestra plan, generaciones y créditos restantes

### Métricas de Suscripción
- Gráfico donut interactivo
- Distribución por planes: Enterprise, Professional, Starter
- Porcentajes calculados dinámicamente

### Resumen de Cuota
- Barra de capacidad de API con gradiente
- Créditos totales vendidos
- Costo por token configurable

### Tabla de Detalle
- Lista completa de clientes con todos sus datos
- Estados: Normal (verde), Bajo (amarillo), Crítico (rojo)
- Banner de alerta para clientes con créditos críticos
- Ordenable y con todos los consumos

### Filtros
- Selector de período: Últimos 7, 30 o 90 días
- Todos los datos se actualizan automáticamente

## 🔄 Datos Conectados

Todos los widgets están conectados a:
- **Base de datos real** vía Prisma
- **Generaciones** del modelo `Generation`
- **Clientes** del modelo `Client`
- **Cálculos en tiempo real** sin datos estáticos

## 🎨 Diseño

- Fondo blanco limpio con cards con sombras
- Colores: 
  - Azul (#3b82f6) - Enterprise
  - Verde (#10b981) - Professional  
  - Gris (#9ca3af) - Starter
  - Rojo (#ef4444) - Alertas
  - Naranja (#f59e0b) - Créditos
  - Morado (#8b5cf6) - API
- Responsive (mobile, tablet, desktop)
- Iconos de Lucide React
- Gráfico donut en SVG puro

## 🔧 Configuración Adicional

Para modificar los precios de planes, edita el archivo:
`/app/api/dashboard/financial/route.ts`

```typescript
const CONFIG = {
  capacidadAPI: 100000,
  costoPorToken: 0.002,
  precioPlanes: {
    enterprise: 299,
    professional: 99,
    starter: 29,
    free: 0,
  },
};
```

## 📝 Notas

- Los datos se actualizan automáticamente al cambiar el período
- Las alertas se muestran solo si hay clientes con créditos < 10%
- El porcentaje de API se calcula como: (total generaciones / capacidad) × 100
- Los ingresos se calculan desde `monthlyRevenue` de cada cliente
