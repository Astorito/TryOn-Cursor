# FUTURE ROADMAP - Roadmap y Evolución Futura

## Tabla de Contenidos

- [Visión del producto](#visión-del-producto)
- [Deuda técnica actual](#deuda-técnica-actual)
- [Roadmap por versiones](#roadmap-por-versiones)
- [Features solicitadas](#features-solicitadas)
- [Mejoras del widget](#mejoras-del-widget)
- [Mejoras del backend](#mejoras-del-backend)
- [Mejoras del dashboard](#mejoras-del-dashboard)
- [Integraciones futuras](#integraciones-futuras)
- [Modelo de negocio y pricing](#modelo-de-negocio-y-pricing)
- [Métricas de éxito](#métricas-de-éxito)

---

## Visión del Producto

**Objetivo**: Ser la solución SaaS líder de virtual try-on para e-commerce en español, ofreciendo un widget embeddable que cualquier tienda pueda integrar en menos de 5 minutos.

**Propuesta de valor**:
1. Integración ultra-simple (1 línea de `<script>`)
2. Baja latencia (<5s por generación)
3. Alta calidad de resultados (modelos de última generación)
4. Dashboard completo con analytics
5. Pricing accesible para SMBs

---

## Deuda Técnica Actual

### Crítica (Bloquea producción)

| # | Deuda | Archivo(s) | Esfuerzo |
|---|---|---|---|
| 1 | API keys hardcodeadas en código | `lib/auth.ts` | 1 día |
| 2 | Datos en memoria (se pierden en redeploy) | `lib/metrics-store.ts` | 3 días |
| 3 | Sin rate limiting | Todos los endpoints | 1 día |
| 4 | Contraseña admin por defecto | `app/api/auth/login/route.ts` | 0.5 días |
| 5 | Empresas dinámicas no pueden autenticarse | `lib/auth.ts` + `app/api/clients/route.ts` | 1 día |

### Alta (Impide escalar)

| # | Deuda | Archivo(s) | Esfuerzo |
|---|---|---|---|
| 6 | CORS abierto `*` | `middleware.ts`, `next.config.js` | 1 día |
| 7 | Cookie session no segura (`"authenticated"`) | `middleware.ts`, login route | 2 días |
| 8 | Sin tests automatizados | - | 5 días |
| 9 | Widget monolítico (1507 líneas) | `lib/widget-core.js` | 3 días |
| 10 | `fal-client.ts` vs `fal-async.ts` usan APIs diferentes | `lib/fal-*.ts` | 1 día |

### Media (Mejoras de calidad)

| # | Deuda | Archivo(s) | Esfuerzo |
|---|---|---|---|
| 11 | Sin logging estructurado | Todos | 2 días |
| 12 | Sin error tracking (Sentry) | - | 1 día |
| 13 | Onboarding bug (lee localStorage pero no escribe) | `lib/widget-core.js` | 0.5 días |
| 14 | Sin validación de schema (Zod) | API routes | 2 días |
| 15 | `MetricsDashboard.tsx` legacy no usado | `components/` | 0.5 días |

---

## Roadmap por Versiones

### v1.1 — Estabilización (2-3 semanas)

**Objetivo**: Hacer el sistema production-ready.

- [ ] Migrar API keys a base de datos (Supabase)
- [ ] Implementar rate limiting con `@upstash/ratelimit`
- [ ] Restringir CORS por dominio del cliente
- [ ] JWT para sesiones admin
- [ ] Eliminar default de `ADMIN_PASSWORD`
- [ ] Unificar interfaces de `fal-client.ts` y `fal-async.ts`
- [ ] Corregir bug de onboarding en widget
- [ ] Agregar validación con Zod
- [ ] CI pipeline básico (lint + build)

### v1.2 — Observabilidad (1-2 semanas)

**Objetivo**: Poder diagnosticar problemas en producción.

- [ ] Integrar Sentry para error tracking
- [ ] Structured logging (JSON en todos los endpoints)
- [ ] Health check mejorado con servicio de cada componente
- [ ] Alertas automáticas (Sentry + uptime monitor)
- [ ] Dashboard de métricas mejorado con datos persistentes

### v2.0 — Multi-Modelo (3-4 semanas)

**Objetivo**: No depender de un solo proveedor de IA.

- [ ] Abstracción de proveedores AI (`AIProvider` interface)
- [ ] Integrar Replicate como fallback
- [ ] Cache de resultados en Redis (hash de inputs)
- [ ] CDN propio para imágenes resultado (Cloudflare R2)
- [ ] A/B testing de modelos (comparar calidad)
- [ ] Métricas de calidad por modelo

### v2.1 — Widget Avanzado (2-3 semanas)

**Objetivo**: Mejorar la experiencia del usuario final.

- [ ] Modularizar widget en componentes separados
- [ ] Convertir a TypeScript con build step (Rollup)
- [ ] Soporte para temas/colores personalizables
- [ ] Galería de resultados anteriores
- [ ] Compartir resultado en redes sociales
- [ ] Widget responsive mejorado (tablet landscape)
- [ ] Accesibilidad (ARIA labels, keyboard navigation)
- [ ] Internacionalización (i18n)

### v3.0 — Plataforma (4-6 semanas)

**Objetivo**: Convertir de proyecto a plataforma SaaS.

- [ ] Portal self-service para clientes
- [ ] Onboarding automatizado (registro → API key → widget tag)
- [ ] Billing y facturación (Stripe)
- [ ] Múltiples usuarios por empresa (roles)
- [ ] API pública documentada con SDK
- [ ] Webhooks para eventos (generación completada, etc.)
- [ ] Marketplace de modelos (elegir modelo por calidad/velocidad/precio)

---

## Features Solicitadas

### Widget

| Feature | Prioridad | Complejidad | Descripción |
|---|---|---|---|
| Soporte de video | Alta | Alta | Try-on en video, no solo fotos |
| Multi-prenda simultánea | Alta | Media | Enviar todas las prendas en una llamada (no serial) |
| Colores configurables por cliente | Alta | Baja | Personalizar FAB, panel, botones |
| Galería de looks guardados | Media | Media | Historial de try-ons del usuario |
| Share social | Media | Baja | Compartir en Instagram, WhatsApp |
| Modo catálogo | Media | Media | Ver todas las prendas del cliente en el widget |
| AR preview | Baja | Muy alta | Realidad aumentada en cámara |

### Backend

| Feature | Prioridad | Complejidad | Descripción |
|---|---|---|---|
| Batch processing | Alta | Media | Generar múltiples looks en una request |
| Webhook notifications | Alta | Baja | Notificar al cliente cuando el job termine |
| Image caching | Alta | Media | No regenerar si mismos inputs |
| Multi-region | Media | Alta | Deploy en múltiples regiones para baja latencia |
| Model selection per-client | Media | Media | Cada cliente elige su modelo |
| Priority queues | Media | Media | Jobs prioritarios para clientes premium |

### Dashboard

| Feature | Prioridad | Complejidad | Descripción |
|---|---|---|---|
| Export CSV/PDF | Alta | Baja | Exportar datos de analytics |
| Alertas configurables | Alta | Media | Email cuando métricas bajan |
| Comparación periodos | Media | Media | "Esta semana vs anterior" |
| Mapa geográfico | Baja | Media | De dónde vienen los usuarios |
| Logs en tiempo real | Media | Media | Stream de eventos en el dashboard |

---

## Mejoras del Widget

### Personalización por cliente

```javascript
// Futuro: configuración vía atributos del script tag
<script
  src="https://api.tryon.com/api/widget"
  data-api-key="client_key"
  data-primary-color="#FF6B00"
  data-position="bottom-left"
  data-language="es"
  data-theme="dark"
  defer
></script>
```

### Eventos para el cliente

```javascript
// Futuro: API de eventos para que el e-commerce reaccione
window.addEventListener('tryon:generation_complete', (event) => {
  const { resultImage, garments } = event.detail;
  // Mostrar CTA "Comprar este look"
  showBuyButton(garments);
});

window.addEventListener('tryon:widget_close', () => {
  // Track engagement
  analytics.track('tryon_widget_closed');
});
```

### Modo catálogo integrado

```javascript
// Futuro: prendas pre-cargadas desde el catálogo del cliente
<script
  src="https://api.tryon.com/api/widget"
  data-api-key="client_key"
  data-catalog-url="https://tienda.com/api/products"
  defer
></script>
```

---

## Mejoras del Backend

### API v2 (breaking changes)

```
/api/v2/generate     → Soporta batch, cache, model selection
/api/v2/jobs         → Webhooks, priority queues
/api/v2/clients      → Self-service registration
/api/v2/analytics    → Real-time streaming
```

### Procesamiento paralelo de prendas

```typescript
// Actual: Serial (una prenda a la vez)
for (const garment of garments) {
  result = await fal.subscribe(model, { person_image: result, garment_image: garment });
}

// Futuro: Parallel con merge
const [top, bottom, shoes] = await Promise.all([
  fal.subscribe(topModel, { person: user, garment: topGarment }),
  fal.subscribe(bottomModel, { person: user, garment: bottomGarment }),
  fal.subscribe(shoesModel, { person: user, garment: shoesGarment }),
]);
const merged = await mergeResults(top, bottom, shoes);
```

### Warm-up proactivo

```typescript
// Futuro: Cron job que mantiene las funciones calientes
// Vercel Cron:
// vercel.json: { "crons": [{ "path": "/api/health", "schedule": "*/5 * * * *" }] }
```

---

## Mejoras del Dashboard

### Analytics avanzados

- **Funnel analysis**: Widget open → Image upload → Garment select → Generate → Download
- **Cohort analysis**: Retención de usuarios por semana
- **Revenue tracking**: Conversiones atribuidas al widget
- **A/B testing dashboard**: Comparar modelos, configuraciones

### Multi-tenancy

```
/dashboard/companies        → Lista de empresas
/dashboard/companies/:id    → Detalle de una empresa
/dashboard/companies/:id/analytics → Analytics por empresa
/dashboard/companies/:id/settings  → Config del widget
/dashboard/billing          → Facturación
/dashboard/team             → Gestión de usuarios admin
```

---

## Integraciones Futuras

| Integración | Tipo | Prioridad | Descripción |
|---|---|---|---|
| **Shopify** | Plugin | Alta | App de Shopify para instalación 1-click |
| **WooCommerce** | Plugin | Alta | Plugin de WordPress |
| **Stripe** | Billing | Alta | Pagos y suscripciones |
| **PostHog** | Analytics | Media | Product analytics externo |
| **Segment** | Data | Media | CDP para unificar datos |
| **Slack** | Notificaciones | Baja | Alertas de errores/métricas |
| **Zapier/Make** | Automation | Baja | Integraciones no-code |
| **PrestaShop** | Plugin | Media | Plugin para tiendas hispanohablantes |
| **VTEX** | Plugin | Media | Popular en Latam |

### Shopify App (Concepto)

```
shopify-tryon-app/
├── app/                    # Remix app (Shopify App framework)
├── extensions/
│   └── tryon-widget/       # Theme App Extension
│       ├── blocks/
│       │   └── tryon.liquid # Bloque del widget
│       └── snippets/
│           └── tryon-script.liquid
└── shopify.app.toml
```

---

## Modelo de Negocio y Pricing

### Pricing Propuesto

| Plan | Precio | Generaciones/mes | Features |
|---|---|---|---|
| **Free** | $0 | 100 | Widget básico, 1 prenda |
| **Starter** | $29/mes | 1,000 | 3 prendas, analytics básico |
| **Pro** | $99/mes | 5,000 | Personalización, soporte prioritario |
| **Enterprise** | Custom | Ilimitadas | Multi-modelo, SLA, API dedicada |

### Revenue por generación

| Plan | Costo FAL/gen | Precio/gen | Margen |
|---|---|---|---|
| Free | ~$0.03 | $0 | -$0.03 |
| Starter | ~$0.03 | $0.029 | -$0.001 |
| Pro | ~$0.03 | $0.0198 | -$0.01 |
| Enterprise | ~$0.02 (volume) | Custom | Positivo |

> **Nota**: En los planes bajos, el modelo de negocio es "freemium" → convertir free a Starter/Pro.

### Métricas de revenue

| Escenario | Clientes | Gen/mes | Revenue | Costo IA | Margen |
|---|---|---|---|---|---|
| Año 1 (launch) | 10 | 5,000 | $500 | $150 | $350 |
| Año 1 (growth) | 50 | 50,000 | $3,000 | $1,500 | $1,500 |
| Año 2 | 200 | 500,000 | $20,000 | $10,000 | $10,000 |

---

## Métricas de Éxito

### Métricas técnicas

| Métrica | Objetivo actual | Objetivo v2 | Objetivo v3 |
|---|---|---|---|
| Latencia P95 | <15s | <8s | <5s |
| Error rate | <5% | <1% | <0.5% |
| Uptime | 99% | 99.5% | 99.9% |
| Cold start | <3s | <1s | Eliminado |

### Métricas de producto

| Métrica | Definición | Objetivo |
|---|---|---|
| Conversion rate | % de widget opens que generan imagen | >30% |
| Completion rate | % de generaciones exitosas | >95% |
| Share rate | % de resultados compartidos | >10% |
| Repeat usage | % de usuarios que lo usan >1 vez | >40% |
| NPS (clientes) | Satisfacción de tiendas usando el widget | >50 |

### Métricas de negocio

| Métrica | Definición | Objetivo Año 1 |
|---|---|---|
| MRR | Monthly Recurring Revenue | $3,000 |
| Churn | % de clientes que cancelan/mes | <5% |
| CAC | Costo de adquisición de cliente | <$50 |
| LTV | Valor lifetime de un cliente | >$500 |
| Payback period | Meses para recuperar CAC | <3 meses |

---

## Timeline Visual

```
Q1 2026: v1.1 Estabilización
  ├── DB migration
  ├── Rate limiting
  ├── Auth improvements
  └── CI pipeline

Q2 2026: v1.2 + v2.0
  ├── Observabilidad
  ├── Multi-modelo
  ├── Cache
  └── CDN propio

Q3 2026: v2.1 Widget Avanzado
  ├── Personalización
  ├── TypeScript widget
  ├── i18n
  └── Shopify App (beta)

Q4 2026: v3.0 Plataforma
  ├── Self-service portal
  ├── Stripe billing
  ├── Shopify App (launch)
  └── API pública
```

---

> **Referencias**: Ver [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) para detalles técnicos de migración, [ARCHITECTURE.md](ARCHITECTURE.md) para la arquitectura actual, y [SECURITY.md](SECURITY.md) para mejoras de seguridad pendientes.
