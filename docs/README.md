# 🎨 TryOn - Virtual Try-On System

Sistema completo de virtual try-on basado en IA. Widget embebible que permite a los usuarios probarse prendas virtualmente.

## 🚀 Inicio Rápido

### 1. Configurar el Sistema

```bash
# Ejecutar servidor
node server.js

# En otra terminal, configurar sistema
node setup-complete.js
```

### 2. Acceder al Dashboard

- **Dashboard Admin**: `http://localhost:3000/dashboard`
- **API Setup**: `http://localhost:3000/api/setup`
- **Widget JS**: `http://localhost:3000/api/widget.js`

## 🏗️ Arquitectura

Siguiendo Clean Architecture y tus reglas de desarrollo:

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA: UI / PRESENTACIÓN                 │
│  - Widget Vanilla JS (Shadow DOM)                         │
│  - Dashboard React + Tailwind CSS                         │
│  - Sin lógica de negocio, solo renderizado                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                    CAPA: APPLICATION / USE CASES           │
│  - API Routes (Next.js)                                   │
│  - Orquestación de flujos                                 │
│  - Manejo de errores y estados                            │
│  - Sin acceso directo a DB                                │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                    CAPA: DOMAIN                           │
│  - Lógica de negocio pura                                 │
│  - Validaciones, reglas, cálculos                         │
│  - Sin dependencias externas                              │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                    CAPA: INFRASTRUCTURE                    │
│  - Supabase PostgreSQL                                    │
│  - FAL AI (modelo nano-banana-pro/edit)                    │
│  - Repositories y servicios externos                      │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Integración

### Para Clientes

1. **Crear Cliente**: Usa el dashboard para crear un nuevo cliente
2. **Obtener Script**: Copia el código de integración generado
3. **Pegar en HTML**: Agrega el script en tu sitio web

```html
<!DOCTYPE html>
<html>
<head>
    <title>Mi Tienda</title>
</head>
<body>
    <!-- Contenido de tu tienda -->

    <!-- TryOn Widget -->
    <script src="http://localhost:3000/api/widget.js"
            data-tryon-key="tu_api_key_aqui"></script>
</body>
</html>
```

### Para Desarrolladores

```javascript
// API Key de tu cliente
const apiKey = 'tu_api_key_aqui';

// Endpoint de generación
const response = await fetch('http://localhost:3000/api/images/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    apiKey: apiKey,
    userImage: 'data:image/jpeg;base64,...', // Foto del usuario
    garments: ['data:image/jpeg;base64,...'] // Hasta 3 prendas
  })
});

const result = await response.json();
console.log('Resultado:', result.data.resultUrl);
```

## 🔧 API Endpoints

### Widget
- `GET /api/widget.js` - Sirve el JavaScript del widget

### Generación
- `POST /api/images/generate` - Genera imagen virtual try-on
- `POST /api/images/upload` - Pre-subida de imágenes

### Administración
- `GET /api/setup` - Inicializa/verifica sistema
- `POST /api/setup` - Crea nuevos clientes
- `GET /dashboard` - Panel de administración

### Métricas
- `GET /api/metrics` - Obtiene métricas de uso

## 📊 Dashboard

### Funcionalidades
- ✅ Crear nuevos clientes
- ✅ Generar API keys automáticamente
- ✅ Copiar scripts de integración
- ✅ Ver métricas de uso
- ✅ Monitoreo en tiempo real

### Métricas Disponibles
- Generaciones totales por cliente
- Uso mensual
- Última generación
- Estado del sistema

## 🔒 Seguridad

### Rate Limiting
- 10 requests/min por API key
- 5 login attempts/15 min por IP

### Validación
- Zod schemas para todas las entradas
- Sanitización de datos
- Autenticación por API key

### CORS
- Lista blanca de dominios por cliente
- Headers de seguridad incluidos

## 🎯 Próximos Pasos

### Fase 3: Performance & Caché
- ✅ Implementar caché de resultados
- ✅ Optimización de imágenes
- ✅ CDN para assets

### Fase 4: Analytics Avanzado
- ✅ Dashboard con gráficos
- ✅ Métricas en tiempo real
- ✅ Exportación de datos

### Fase 5: Multi-Tenant
- ✅ Soporte para múltiples clientes
- ✅ Aislamiento de datos
- ✅ Billing por uso

## 📝 Notas de Desarrollo

### Reglas Seguidas
- ✅ Máximo 300 líneas por archivo
- ✅ Arquitectura por capas clara
- ✅ Separación UI/Domain/Infrastructure
- ✅ Validación con Zod
- ✅ Error handling centralizado
- ✅ No overengineering

### Dependencias
- **Supabase**: Base de datos serverless
- **FAL AI**: Modelo de virtual try-on
- **Zod**: Validación de schemas
- **Next.js**: Framework API routes

### Variables de Entorno
```env
# Supabase (ya configurado)
DATABASE_URL=postgresql://...

# FAL AI
FAL_KEY=tu_fal_key

# Admin
ADMIN_KEY=admin_key_tryon_2024_secure
ADMIN_PASSWORD=tryon_admin_secure_2024
```

## 🚀 Deploy

### Vercel (Recomendado)
```bash
npm install -g vercel
vercel --prod
```

### Otros
- Railway
- Render
- Digital Ocean App Platform

## 📞 Soporte

Para soporte técnico:
1. Verifica logs en consola del navegador (F12)
2. Revisa `/api/setup` para estado del sistema
3. Consulta métricas en el dashboard

---

**🎨 TryOn - Transformando el ecommerce con IA**