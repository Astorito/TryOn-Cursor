# UI/UX SPECIFICATION - Especificación Completa de Interfaz

## Tabla de Contenidos

- [Visión general del Widget](#visión-general-del-widget)
- [Estados del Widget](#estados-del-widget)
- [Flujo de usuario completo](#flujo-de-usuario-completo)
- [Componentes UI del Widget](#componentes-ui-del-widget)
- [Sistema de Drag & Drop](#sistema-de-drag--drop)
- [Sistema de Onboarding](#sistema-de-onboarding)
- [Responsive Design](#responsive-design)
- [Shadow DOM](#shadow-dom)
- [Dashboard de Administración](#dashboard-de-administración)
- [Página de Login](#página-de-login)

---

## Visión General del Widget

El widget TryOn es un componente **auto-contenido** que se inyecta en sitios web externos mediante un `<script>` tag. Se ejecuta dentro de un **Shadow DOM** para aislar completamente sus estilos del sitio host.

### Integración (una línea)

```html
<script src="https://tryon-backend.vercel.app/api/widget" data-tryon-key="API_KEY"></script>
```

### Tecnología

- **Vanilla JavaScript** (sin frameworks)
- **Shadow DOM** para aislamiento
- **CSS-in-JS** (estilos inlined en el shadow root)
- **IIFE** (Immediately Invoked Function Expression) auto-ejecutable

---

## Estados del Widget

### 1. Estado Inicial - FAB Cerrado

```
┌──────────────────────────────────┐
│         SITIO WEB HOST           │
│                                  │
│                                  │
│                                  │
│                                  │
│                  ┌──────────────┐│
│                  │ ✨ Try look  ││  ← FAB (Floating Action Button)
│                  └──────────────┘│
└──────────────────────────────────┘
```

**Estilos del FAB:**
- Posición: `fixed`, `bottom: 24px`, `right: 24px`
- Dimensiones: `120px × 56px`
- Background: `linear-gradient(135deg, #667eea, #764ba2)` (azul → púrpura)
- Border radius: `28px` (pill shape)
- Font: `16px, weight 600, color white`
- Shadow: `0 4px 12px rgba(0,0,0,0.15)`
- Z-index: `999999`
- Hover: `translateY(-2px)`, shadow más pronunciado
- Active: `translateY(0)`
- Texto: `✨ Try look`

### 2. Panel Abierto Vacío

```
┌──────────────────────────────────┐
│         SITIO WEB HOST           │
│                     ┌───────────┐│
│                     │ Powered   ×││ ← Header
│                     │───────────││
│                     │ 📸        ││
│                     │ Click or  ││ ← Upload box (user photo)
│                     │ drag...   ││
│                     │───────────││
│                     │ Add garm. ││
│                     │ 👕  👔  👗││ ← 3 garment slots
│                     │───────────││
│                     │[Try Look] ││ ← Submit (disabled)
│                     └───────────┘│
│                  ┌──────────────┐│
│                  │ ✨ Try look  ││
│                  └──────────────┘│
└──────────────────────────────────┘
```

**Estilos del Panel:**
- Posición: `fixed`, `bottom: 82px`, `right: 24px`
- Dimensiones: `320px × 480px` (fijo)
- Max-width: `calc(100vw - 48px)`
- Max-height: `calc(100vh - 82px - 10px)`
- Background: `white`
- Border: `1px solid #e5e7eb`
- Border radius: `16px`
- Shadow: `0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)`
- Z-index: `1000000`
- Animación de apertura: `translateY(16px) scale(0.95) → translateY(0) scale(1)` + `opacity 0→1`
- Transición: `0.25s cubic-bezier(0.4, 0, 0.2, 1)`

### 3. Panel con Imágenes Cargadas

```
┌───────────────────┐
│ Powered by TryOn ×│
│───────────────────│
│ Upload your photo │
│ ┌───────────────┐ │
│ │   [Foto del   │ │  ← Has image (border sólido)
│ │   usuario]  × │ │  ← Botón remove (esquina sup der)
│ └───────────────┘ │
│ Add garments      │
│ ┌────┐┌────┐┌────┐│
│ │Img1││ 👔 ││ 👗 ││  ← Slot 0 con imagen, slots 1-2 vacíos
│ │  × │└────┘└────┘│
│ └────┘            │
│───────────────────│
│ [  Try Look     ] │  ← Submit (ENABLED - azul/púrpura)
└───────────────────┘
```

**Upload box con imagen:**
- Border: `2px solid #e5e7eb` (ya no dashed)
- Imagen: `object-fit: contain`
- Botón remove: círculo `28px`, `rgba(0,0,0,0.7)`, `border-radius: 50%`

**Submit button (enabled):**
- Width: `100%`
- Padding: `14px`
- Background: `linear-gradient(135deg, #667eea, #764ba2)`
- Border radius: `12px`
- Font: `15px, weight 600`
- Hover: `translateY(-2px)`, shadow `rgba(102,126,234,0.4)`

### 4. Loading (4 Fases)

El loading tiene una animación minimalista con texto que cambia:

```
┌───────────────────┐
│ Powered by TryOn ×│
│───────────────────│
│                   │
│                   │
│                   │
│   Analyzing •••   │  ← Texto + dots animados
│                   │
│                   │
│                   │
│───────────────────│
│ [Generating...  ] │  ← Botón disabled
└───────────────────┘
```

**Secuencia de loading:**

| Fase | Texto | Duración | Timing |
|---|---|---|---|
| 1 | `Analyzing` | 3 segundos | 0-3s |
| 2 | `Adjusting` | 3 segundos | 3-6s |
| 3 | `Applying` | 4 segundos | 6-10s |
| 4 | `Finalizing` | ∞ (hasta terminar) | 10s+ |

**Animaciones:**
- **Texto**: `typeIn` — opacity 0→1 + translateY(10px→0) en 0.6s
- **Dots** (3 puntos): `dotPulse` — cada dot pulsa opacity 0→1→0 con delay escalonado (0s, 0.2s, 0.4s)
- **Fade out**: animación `fadeOut` de 0.4s al completar

**Estilos del loading:**
- Container: absolute, full panel, background white, z-index 10
- Texto: `24px, weight 600, color #667eea`
- Dots: `6px × 6px`, border-radius 50%, color `#667eea`

### 5. Resultado Mostrado

```
┌───────────────────┐
│ Powered by TryOn ×│  ← Header se mantiene visible
│───────────────────│
│ ┌─────────────┐   │
│ │           × │   │  ← Botón close resultado (floating)
│ │             │   │
│ │  [Imagen    │   │  ← Resultado de try-on
│ │   generada] │   │     (zoom 2x on mousemove)
│ │             │   │
│ │             │   │
│ └─────────────┘   │
│ 🔲 🔲 [+]         │  ← Thumbnails de garments usados + botón "+"
│───────────────────│
│[Try another look] │  ← Botón amarillo
└───────────────────┘
```

**Panel en modo resultado:**
- Clase `has-result` se agrega al panel
- Panel se expande: `top: 0`, `bottom: 82px` (llena hasta casi el viewport)
- La UI de upload se oculta (`display: none`)
- Result box se muestra (`display: flex`)

**Imagen resultado:**
- Container: border `2px solid #e5e7eb`, border-radius `16px`, padding `8px`
- Imagen: `object-fit: contain`, `cursor: zoom-in`
- **Zoom interactivo**: on `mousemove`, el `transform-origin` sigue el cursor y aplica `scale(2)`. On `mouseleave`, vuelve a `scale(1)`.

**Thumbnails de inputs usados:**
- Tamaño: `60px × 60px`
- Border: `2px solid #e5e7eb`, border-radius `12px`
- Background: `#f9fafb`
- El botón "+" (empty) tiene border dashed y abre `resetToInitial()`

**Submit button (completed):**
- Background: `linear-gradient(135deg, #fbbf24, #f59e0b)` (amarillo/dorado)
- Texto: "Try another look"

### 6. Estados de Error

Los errores se muestran con `alert()` nativo del navegador:

- **Sin imagen de usuario**: `"Please upload both your photo and at least one garment image."`
- **Error de generación**: `"Error: {message}"` donde message viene del backend
- **Error de upload a FAL**: `"No se pudo subir la imagen. Verifica tu conexión."`

> **Mejora pendiente**: Reemplazar `alert()` con un componente de error inline dentro del widget.

---

## Flujo de Usuario Completo

### Paso 1: Carga del widget
1. El sitio host incluye `<script src=".../api/widget" data-tryon-key="KEY">`.
2. El script se descarga y auto-ejecuta (IIFE).
3. Verifica que `data-tryon-key` existe, si no → `console.error` y sale.
4. Detecta URL del backend desde `script.src`.
5. Crea el contenedor `#tryon-widget-root` en `document.body`.
6. Crea Shadow DOM (`mode: 'open'`).
7. Inyecta CSS + HTML dentro del shadow root.
8. Muestra el FAB (`✨ Try look`).

### Paso 2: Primera interacción (Onboarding)
1. Si `localStorage.getItem('tryon_onboarding_done')` es null → mostrar onboarding.
2. El onboarding es un overlay que cubre toda la pantalla.
3. Texto: "Welcome to TryOn! 👋" + explicación.
4. Botón "Got it!" → guarda en localStorage, cierra.

### Paso 3: Abrir el widget
1. Usuario hace click en FAB.
2. Se muestra overlay (transparente, `pointer-events: none`).
3. Panel aparece con animación scale+fade.
4. Si es primera vez, se muestra onboarding encima.

### Paso 4: Subir foto del usuario
1. Click en el box "📸 Click or drag to upload" → abre selector de archivos.
2. También soporta drag & drop.
3. El archivo se convierte a base64 y se comprime (max 1080px, JPEG 85%).
4. Se muestra preview en el upload box.
5. Aparece botón × para eliminar.

### Paso 5: Subir prendas (1-3)
1. Hay 3 slots: 👕, 👔, 👗.
2. Click en cualquier slot → selector de archivos.
3. También soporta drag & drop por slot.
4. Se comprime igual que la foto del usuario.
5. Se muestra preview, con botón × para eliminar.

### Paso 6: Generar
1. Botón "Try Look" se habilita cuando hay foto + al menos 1 prenda.
2. Click en botón dispara:
   - Estado cambia a `processing`.
   - Botón se deshabilita con texto "Generating...".
   - Se inicia secuencia de loading animado.
   - Las imágenes se **optimizan para inferencia** (768px altura, JPEG 75%).
   - Se envía POST a `/api/images/generate` con `apiKey`, `userImage` y `garments`.
3. Mientras espera (~5-15s):
   - Los textos de loading cambian automáticamente.

### Paso 7: Resultado
1. Al recibir respuesta exitosa:
   - Se detiene la animación de loading (fade out 0.4s).
   - El panel cambia a modo `has-result` (se expande hacia arriba).
   - La imagen resultado se muestra con zoom interactivo.
   - Los thumbnails de las prendas usadas aparecen abajo.
   - El botón cambia a "Try another look" (amarillo).
2. Al recibir error:
   - Se detiene loading.
   - Se muestra `alert()` con el mensaje de error.
   - Estado vuelve a `idle`.

### Paso 8: Nueva generación
1. Click en "Try another look" o botón "+" en thumbnails → `resetToInitial()`.
2. Se oculta resultado, se vuelve a mostrar UI de upload.
3. Las imágenes previas siguen en el estado (no se borran automáticamente).

### Paso 9: Cerrar
1. Click en × del header o click fuera del panel (en el overlay).
2. El panel se cierra con animación inversa (0.3s delay antes de `display: none`).

---

## Componentes UI del Widget

### FAB (Floating Action Button)
| Propiedad | Valor |
|---|---|
| Posición | Fixed, bottom-right (24px margin) |
| Dimensiones | 120×56px |
| Colores | Gradiente azul→púrpura |
| Texto | "✨ Try look" |
| Animación hover | translateY(-2px) |
| z-index | 999999 |

### Panel
| Propiedad | Valor |
|---|---|
| Posición | Fixed, encima del FAB |
| Dimensiones | 320×480px (fijo) |
| Máximas | 100vw-48px width, viewport-92px height |
| Border | 1px solid #e5e7eb |
| Border radius | 16px |
| Animación apertura | scale(0.95→1) + fade + translateY |

### Header
| Propiedad | Valor |
|---|---|
| Contenido | "Powered by TryOn.com" + botón × |
| Altura | Auto (padding 12px 20px) |
| Border bottom | 1px solid #e5e7eb |
| Font | 14px, #6b7280, weight 500 |

### Upload Box (Foto del usuario)
| Propiedad | Valor |
|---|---|
| Altura | 150px (max 150px) |
| Border | 2px dashed #d1d5db → sólido cuando tiene imagen |
| Background | #f9fafb → #f3f4f6 con imagen |
| Hover | Border #667eea, background #f5f7ff |
| Contenido vacío | Emoji 📸 (48px) + texto "Click or drag" |

### Garment Slots
| Propiedad | Valor |
|---|---|
| Layout | Grid 3 columnas, gap 10px |
| Tamaño | aspect-ratio 1:1, max 80px |
| Border | 2px dashed #d1d5db |
| Background | #f9fafb |
| Emojis | 👕, 👔, 👗 |

### Submit Button
| Estado | Apariencia |
|---|---|
| Disabled | Opacity 0.5, cursor not-allowed |
| Enabled (idle) | Gradiente azul→púrpura, "Try Look" |
| Processing | Background #9ca3af, "Generating..." |
| Completed | Gradiente amarillo (#fbbf24→#f59e0b), "Try another look" |

### Botón Remove (×)
| Propiedad | Valor |
|---|---|
| Posición | Absolute, top-right (8px) |
| Tamaño | 28px circle |
| Background | rgba(0,0,0,0.7) → 0.9 on hover |
| Color | White |
| Font size | 18px |

---

## Sistema de Drag & Drop

El widget soporta drag & drop para todas las zonas de upload:

### User photo box
- `dragover`: preventDefault + clase `drag-over`
- `dragleave`: remove clase
- `drop`: preventDefault, extrae `files[0]`, valida tipo `image/*`, llama `handleUserImageUpload(file)`

### Garment boxes (×3)
- Mismo patrón que user photo
- Cada box tiene su índice (0, 1, 2)
- Al drop: `handleGarmentUpload(file, index)`

### Overlay
- El overlay tiene `pointer-events: none` **siempre** para no bloquear el drag
- Clase `.dragging` aplica `pointer-events: none !important`

> **Nota**: El drag & drop funciona dentro del Shadow DOM porque los event listeners se configuran directamente en los elementos del shadow root.

---

## Sistema de Onboarding

### Cuándo aparece
- En la **primera visita** del usuario.
- Se detecta con `localStorage.getItem('tryon_onboarding_done')`.
- Si el valor es `null` → mostrar onboarding.

### Cómo se ve

```
┌─────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← Overlay negro 80%
│ ▓                                 ▓│
│ ▓  ┌───────────────────────────┐  ▓│
│ ▓  │   Welcome to TryOn! 👋   │  ▓│
│ ▓  │                           │  ▓│
│ ▓  │  Upload your photo and    │  ▓│
│ ▓  │  add garments to see how  │  ▓│
│ ▓  │  they look on you.        │  ▓│
│ ▓  │                           │  ▓│
│ ▓  │       [ Got it! ]         │  ▓│
│ ▓  └───────────────────────────┘  ▓│
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
└─────────────────────────────────────┘
```

### Cómo se guarda
- Al click en "Got it!":
  - `state.showOnboarding = false`
  - `onboarding.style.display = 'none'`
- **También** se oculta tras la primera generación exitosa.
- **No se guarda en localStorage explícitamente** al cerrar; se guarda solo al inicializar el estado: `showOnboarding: !localStorage.getItem('tryon_onboarding_done')`.

> **Bug potencial**: El onboarding no persiste el cierre en localStorage (no se llama `localStorage.setItem`). Esto significa que reaparecerá en cada recarga. Esto debería corregirse en la re-implementación.

### Estilos
- Overlay: fixed, full screen, `rgba(0,0,0,0.8)`, z-index `1000001`
- Content: white, border-radius `16px`, padding `32px`, max-width `400px`
- Título: `24px`, color `#111827`
- Texto: `16px`, color `#6b7280`, line-height `1.6`
- Botón: padding `12px 32px`, gradiente azul→púrpura

---

## Responsive Design

### Desktop (>480px)
- Panel: `320px × 480px`, posicionado bottom-right
- FAB: `120px × 56px`
- Garment grid: 3 columnas

### Mobile (<480px)
- Panel: `max-width: calc(100vw - 48px)` → se adapta al ancho de pantalla
- `max-height: calc(100vh - 82px - 10px)` → nunca excede viewport
- El panel con resultado se expande a full height (`top: 0`, `bottom: 82px`)
- No hay breakpoints CSS explícitos — la adaptación es por max-width/max-height

> **Limitación**: No hay media queries dedicadas. El diseño es "fluid" pero no tiene adaptaciones específicas para mobile (como cambiar el grid de garments a 2 columnas, esconder texto del FAB, etc.).

---

## Shadow DOM

### Por qué se usa
1. **Aislamiento de estilos**: Los CSS del sitio host no afectan al widget.
2. **Sin colisiones de nombres**: IDs y clases del widget no chocan con los del host.
3. **Encapsulación**: El widget es una "caja negra" independiente.

### Cómo se implementa

```javascript
// Crear contenedor en el body del host
const container = document.createElement('div');
container.id = 'tryon-widget-root';
document.body.appendChild(container);

// Crear Shadow DOM
const shadow = container.attachShadow({ mode: 'open' });

// Inyectar estilos + HTML
shadow.innerHTML = `<style>${styles}</style>${html}`;
```

### Qué aísla
- ✅ Estilos CSS del widget (no se filtran al host)
- ✅ Estilos del host (no afectan al widget)
- ✅ IDs de elementos (no colisionan)
- ✅ Clases CSS (no colisionan)
- ❌ `font-family` puede heredarse si se usa `:host` sin reset
- ❌ Variables CSS custom pueden filtrarse (se usa `:host { all: initial }`)
- ❌ El `z-index` del FAB/panel compite con el host

### Acceso a elementos
Todos los `getElementById` y `querySelector` se ejecutan sobre `shadow`, no sobre `document`:

```javascript
const fab = shadow.getElementById('tryon-fab');
const panel = shadow.getElementById('tryon-panel');
```

---

## Dashboard de Administración

El dashboard es una aplicación Next.js con React + Tailwind CSS, protegida por login con cookie.

### Página principal (`/dashboard`)

```
┌──────────────────────────────────────────────────────┐
│ Panel de Administración    [Dashboard] [Analíticas] 🚪│
│──────────────────────────────────────────────────────│
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌────────┐│
│ │🏢 Total   │ │📈 Gener.  │ │⚡ Promedio │ │⏰Cerca │ │
│ │ Empresas  │ │ Totales   │ │por Empresa│ │Límite  ││
│ │   3       │ │  1,250    │ │   417     │ │   0    ││
│ └───────────┘ └───────────┘ └───────────┘ └────────┘│
│                                                      │
│ Generar Nueva Empresa                                │
│ [Alias empresa] [Email empresa] [+ Generar Token]   │
│                                                      │
│ ┌────────────────────────────────────────────────────┐│
│ │ 🔍 Buscar...            [Todas][Activas][Límite]  ││
│ │────────────────────────────────────────────────────││
│ │ Empresa  │ Email  │ Usadas │ Límite │ Disponibles ││
│ │──────────┼────────┼────────┼────────┼─────────────││
│ │ Demo     │ -      │ 500    │ 5000   │ ▓▓▓░░ 4500 ││
│ │ Test     │ -      │ 100    │ 5000   │ ▓░░░░ 4900 ││
│ └────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

### Página de Analíticas (`/dashboard/analytics`)

```
┌──────────────────────────────────────────────────────┐
│ Panel de Administración    [Dashboard] [Analíticas] 🚪│
│──────────────────────────────────────────────────────│
│ Seleccionar Empresas: [Demo✓] [Test✓] [Other]       │
│ Período: [1M] [3M] [6M✓] [1 Año] [All Time]        │
│                                                      │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│ │📈 +12.5% │ │📅 42/día │ │💰 $50    │              │
│ │Crecim.   │ │Prom.Dia  │ │Ingreso   │              │
│ └──────────┘ └──────────┘ └──────────┘              │
│                                                      │
│ ┌───────────────────┐ ┌────────────────────┐         │
│ │ Generaciones/Mes  │ │ Distribución       │         │
│ │  📈 LineChart     │ │  🥧 PieChart       │         │
│ └───────────────────┘ └────────────────────┘         │
│ ┌───────────────────┐ ┌────────────────────┐         │
│ │ Distribución Hora │ │ Ranking Empresas   │         │
│ │  📊 BarChart      │ │  1. Demo - 500     │         │
│ └───────────────────┘ │  2. Test - 100     │         │
│                       └────────────────────┘         │
└──────────────────────────────────────────────────────┘
```

### Componentes del Dashboard

#### MetricCard
- Gradiente de fondo según color (blue, green, purple, orange)
- Icono emoji + título
- Valor en tamaño grande (3xl, bold)

#### CompanyTable
- Búsqueda por nombre/email
- Filtros: Todas, Activas, Cerca del Límite
- Barra de progreso por empresa (verde→naranja→rojo según uso)
- Botón de configuración (⚙️, no implementado)

#### CompanyForm
- Campos: Alias + Email
- Al crear: genera API key automática, copia al clipboard

---

## Página de Login

### URL: `/login`

```
┌──────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│ ▓  ┌──────────────────────────────┐ ▓│
│ ▓  │    🔐 Admin Login           │ ▓│
│ ▓  │  Panel de Administración    │ ▓│
│ ▓  │                             │ ▓│
│ ▓  │  Contraseña:                │ ▓│
│ ▓  │  [________________]        │ ▓│
│ ▓  │                             │ ▓│
│ ▓  │  [    Ingresar    ]        │ ▓│
│ ▓  │                             │ ▓│
│ ▓  │  Default: tryon_admin_2024  │ ▓│
│ ▓  └──────────────────────────────┘ ▓│
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
└──────────────────────────────────────┘
```

- Background: gradiente slate-900 → slate-800
- Card: blanca, rounded-xl, shadow-2xl, max-w-md
- Input: border gray-300, rounded-lg, focus ring blue-500
- Botón: bg-blue-500, text white, hover bg-blue-600
- Error: bg-red-50, border red-200, text red-700
- Auth: POST `/api/auth/login` → cookie `admin_auth` (httpOnly, 7 días)

---

## Paleta de Colores

| Elemento | Color | Hex |
|---|---|---|
| Primary gradient start | Azul | `#667eea` |
| Primary gradient end | Púrpura | `#764ba2` |
| Success gradient start | Amarillo | `#fbbf24` |
| Success gradient end | Ámbar | `#f59e0b` |
| Green accent | Verde | `#10b981` |
| Text primary | Gris oscuro | `#111827` |
| Text secondary | Gris | `#6b7280` |
| Text muted | Gris claro | `#9ca3af` |
| Border | Gris borde | `#e5e7eb` |
| Background light | Gris fondo | `#f9fafb` |
| Background panel | Blanco | `#ffffff` |
| Error | Rojo | `#ef4444` |
| Loading text | Azul primary | `#667eea` |

---

> **Referencias cruzadas**: Ver [ARCHITECTURE.md](ARCHITECTURE.md) para detalles técnicos del widget-core.js, y [API_REFERENCE.md](API_REFERENCE.md) para los endpoints que el widget consume.
