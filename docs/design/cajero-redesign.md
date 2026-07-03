# Rediseño de Layout — Flujo /cajero (Smash POS)

Design handoff. No incluye código de implementación — ver "Handoff target" al final.

---

## 1. Resumen de usuario y contexto

**Usuario objetivo:** empleado con rol `Cajero`, autenticado vía sucursal → empleado → PIN (`src/middleware.ts`). Trabaja en un mostrador fijo durante un turno de caja (`caja.estado = 'abierta'`), bajo presión de tiempo en horas pico, interrumpido constantemente por clientes hablando en simultáneo.

**Meta de producto:** minimizar tiempo y clics por pedido, minimizar errores de cobro (monto, extras, cantidad), mantener al cajero orientado (qué pedido está cobrando, cuánto lleva el turno) sin que tenga que razonar sobre la interfaz.

**Contexto de dispositivo (inferido del código actual, no confirmado con el usuario):**
- El layout actual (`src/app/(usuario)/cajero/ventas/page.tsx`) es `h-screen` fijo, sin breakpoints `sm:`/`md:` propios y con interacciones `hover:` — indica un PC/monitor fijo en el mostrador con mouse+teclado, no un kiosco táctil.
- **Asunción de diseño:** monitor de escritorio, orientación horizontal, ancho mínimo operativo 1280px. Si en realidad es una pantalla táctil, los targets de toque (botones, chips de extras, fila de denominación) deben subir a 44×44px mínimo — lo señalo en cada componente como nota, no lo asumo por defecto.
- No hay layout propio de `/cajero` (`layout.tsx` solo existe en `/admin`) — el flujo es deliberadamente pantalla-completa, sin sidebar de dashboard. **Esto se mantiene en el rediseño**: agregar un sidebar de navegación sería ruido, no ayuda — el cajero no necesita "navegar", necesita completar una tarea lineal.

**Restricciones existentes que el rediseño debe respetar:**
- Paleta de marca ya definida en `globals.css` (`--color-brand-500: #FF1E00`, rojo) — no se introduce paleta nueva.
- Componentes base ya existentes: `Button`, `Select`, `Label`, `Input` (`src/components/form|ui`) — el rediseño reutiliza estos, no los reemplaza.
- Modelo de datos: un pedido tiene `cliente_nombre`, `items[]` (con `extras[]` opcionales y precio), `total`. Hoy `cliente` está **hardcodeado** en el frontend (`"Cliente Mostrador"` en `ventas/page.tsx:116`) — el rediseño lo expone como input real porque afecta directamente "Encontrabilidad" y "Flujo de trabajo" (ver hallazgo H7). **Fuera de alcance por ahora:** el campo `mesa` — se mantiene hardcodeado ("Mesa 1"), no se expone en la UI en esta iteración.

---

## 2. Auditoría del estado actual (hallazgos que justifican el rediseño)

Basado en lectura de código y pruebas manuales (gstack) de `/cajero` → `/cajero/ventas` → `/cajero/metodos-pago` → `/cajero/cierre` en esta sesión.

| # | Hallazgo | Criterio afectado |
|---|----------|---------------------|
| H1 | El catálogo (`ventas/page.tsx`, columna "Catálogo") es una grilla plana sin buscador ni filtro por categoría. Con más de ~10 productos, ubicar uno excede 2s de escaneo visual. | Encontrabilidad |
| H2 | La columna "Personalización" (30% del ancho) está siempre reservada en el layout, incluso vacía (placeholder "Selecciona un producto"). Espacio fijo desperdiciado en el caso más común. | Espaciado y Limpieza |
| H5 | El botón "Comandar" (acción principal, dispara cocina) y "Cancelar" (acción rara/destructiva) tienen el mismo peso visual en una grilla 2 columnas. | Jerarquía Visual |
| H6 | `/cajero/metodos-pago` no tiene botón de volver/cancelar (el prop `onCancel` del componente existe pero la página no lo usa) — si el cajero necesita corregir el pedido, no hay salida visible. | Flujo de Trabajo |
| H7 | `/cajero/metodos-pago` no muestra cliente/N° de pedido — si hay varios pedidos en cola durante un rush, no hay forma de confirmar visualmente "este es el pedido correcto" antes de cobrar. | Encontrabilidad |
| H8 | La barra superior (compartida) solo muestra "Punto de Venta" + "Cerrar Caja" — no hay identidad del cajero ni duración del turno visibles. | Jerarquía Visual |
| H9 | En `/cajero/cierre`, el resumen del sistema (6 tarjetas de método de pago) se muestra siempre expandido arriba de la grilla de conteo, compitiendo por atención con la tarea real (contar efectivo). | Espaciado y Limpieza |
| H10 | El botón eliminar (✕) de cada línea del carrito es un círculo flotante de ~24px — por debajo del mínimo táctil recomendado (44px) si el dispositivo resulta ser táctil. | Accesibilidad (condicional a H/W) |

---

## 3. Layout propuesto

### 3.1 Principio de reordenamiento (aplica a `/cajero/ventas`)

El orden actual de columnas es **Carrito (25%) | Catálogo (45%) | Personalizar (30%)**.

Propuesta: **Catálogo (flexible, ~60%) | Carrito + Checkout (fijo, ~360px, ancla derecha)**, con la personalización como **panel deslizante (drawer)** que aparece sobre el catálogo solo cuando se necesita, no como columna fija.

**Por qué:** en un layout LTR, el ojo entra por la izquierda (donde debe estar la tarea de mayor frecuencia: *elegir producto*) y termina su recorrido a la derecha (donde debe estar la acción terminal: *total + Comandar*). Es el mismo patrón que Square POS, Toast POS y cualquier carrito de e-commerce: precio/checkout ancla a la derecha porque es donde el usuario espera encontrar "cuánto debo / siguiente paso" sin tener que reaprenderlo. Hoy el carrito (estado, no acción) ocupa el lugar de mayor jerarquía (extremo izquierdo) y el catálogo (la acción más frecuente) queda comprimido al centro.

### 3.2 Wireframe — `/cajero/ventas` (estado de reposo, sin producto seleccionado)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ☰ SMASH POS · Cajero: Ana G. · Turno 02:14    [Cliente: __]  [Cerrar Caja] │
├───────────────────────────────────────────────────┬─────────────────────────┤
│  🔍 Buscar producto...              [Todas ▾]      │   PEDIDO ACTUAL  3 ítems│
│  [Todas] [Hamburguesas] [Bebidas] [Sides]          │  ───────────────────── │
│                                                     │  1x Smash Burguer      │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │     +Carne (+Bs5.50)   │
│  │ [img]  │ │ [img]  │ │ [img]  │ │ [img]  │        │              Bs 55.50 │
│  │ Smash  │ │ Tocino │ │ Coca   │ │ Sprite │        │  ───────────────────── │
│  │ Bs50.00│ │ Bs20.00│ │ Bs20.00│ │ Bs10.00│        │  2x Vaso Coca Cola     │
│  └────────┘ └────────┘ └────────┘ └────────┘        │              Bs 40.00 │
│   (clic = agrega 1 al instante; ⋯ = personalizar)   │  ───────────────────── │
│                                                     │                         │
│                                                     │  Subtotal     Bs 95.50 │
│                                                     │  ┌───────────────────┐ │
│                                                     │  │     COMANDAR      │ │ ← dominante
│                                                     │  └───────────────────┘ │
│                                                     │      Cancelar pedido   │ ← texto, menor peso
└─────────────────────────────────────────────────────┴─────────────────────────┘
```

### 3.3 Wireframe — `/cajero/ventas` (drawer de personalización abierto)

Se abre al hacer clic en "⋯" de una tarjeta, o automáticamente si el producto tiene extras configurados y el cajero mantiene clic >400ms (long-press) / clic derecho en desktop. Un clic simple en la tarjeta **siempre** agrega 1 unidad sin extras inmediatamente — esa es la ruta rápida.

```
┌─────────────────────────────────────────────────────────────────┐
│  Catálogo (atenuado, no interactivo mientras el drawer está abierto)
│                                          ┌─────────────────────┐ │
│                                          │ Smash Burguer  ✕    │ │
│                                          │ Bs 50.00            │ │
│                                          │ ─────────────────── │ │
│                                          │ Cantidad   [-] 1 [+]│ │
│                                          │ ─────────────────── │ │
│                                          │ Extras:             │ │
│                                          │  [+ Carne (+Bs5.50)]│ │
│                                          │ ─────────────────── │ │
│                                          │ Notas: [__________] │ │
│                                          │ ┌─────────────────┐ │ │
│                                          │ │   + Agregar     │ │ │
│                                          │ └─────────────────┘ │ │
│                                          └─────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

### 3.4 Wireframe — `/cajero/metodos-pago`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Volver al pedido     Pedido #18 · Cliente Mostrador   [Cerrar Caja]│
├───────────────────────────────────────────────────┬─────────────────────────┤
│  Método de Pago                                   │      Total a Pagar     │
│  [Efectivo] [Tarjeta] [QR] [Transfer] [Gift][Otro] │        Bs 95.50        │
│                                                     │  ───────────────────── │
│  Datos de Facturación (NIT, Razón Social)          │  Monto recibido [___]  │
│                                                     │  Cambio:      Bs 0.00  │
│                                                     │  ┌───────────────────┐ │
│                                                     │  │  CONFIRMAR COBRO  │ │
│                                                     │  └───────────────────┘ │
└─────────────────────────────────────────────────────┴─────────────────────────┘
```

Cambios clave vs. hoy: header con contexto del pedido + botón de volver (H6, H7); resto de la estructura (métodos a la izquierda, total/cobro a la derecha) **se mantiene** porque ya agrupa correctamente "elegir método" con "ver total/cambio" en el mismo golpe de vista.

### 3.5 `/cajero` (apertura) y `/cajero/cierre`

Estructura de `DenominacionesForm` se mantiene (ya cumple bien los 4 criterios: total fijo arriba, grilla agrupada billetes/monedas, CTA clara). Único cambio: en `/cajero/cierre`, el bloque "Resumen del sistema" colapsa por defecto a una sola línea (`Efectivo esperado: Bs X · Ver detalle ▾`), expandible — la tarea real es contar, no leer el resumen (H9).

---

## 4. Flujos y estados

### Flujo: Tomar y comandar un pedido

**Meta:** el cajero registra los productos que el cliente pide y los envía a cocina.

**Entry points:**
- [x] Después de abrir caja (`/cajero` → redirect a `/cajero/ventas`)
- [x] Después de cobrar un pedido anterior (`/cajero/metodos-pago` → redirect a `/cajero/ventas`)
- [x] Directo: `/cajero/ventas` (requiere `tokenSucursal` + `tokenEmpleado` válidos, vía middleware)

**Prerequisitos:**
- [x] Caja abierta para esa sucursal+empleado (si no, ¿redirigir a `/cajero` con mensaje? — *hoy no se valida en `/ventas`, es un gap pre-existente, no introducido por este rediseño; señalado como hallazgo H11 fuera de alcance visual*)

**Pasos:**

1. **Buscar/elegir producto** — Catálogo. Acción: escribir en buscador y/o tocar categoría y/o clic directo en tarjeta. Respuesta: grilla se filtra en vivo (sin botón "buscar"); clic en tarjeta agrega 1 unidad al carrito instantáneamente con micro-feedback (flash verde 200ms en la tarjeta + badge del carrito incrementa). Transición: permanece en catálogo (no bloquea).
2. **(Opcional) Personalizar** — Drawer. Acción: clic en "⋯"/long-press sobre la tarjeta. Respuesta: drawer se abre con cantidad y extras del producto (fetch a `/api/inventarios/modificadores?itemVendibleId=`). Validación: cantidad mínima 1; si el producto no tiene extras configurados, sección "Extras" muestra "Sin extras disponibles" en vez de vacío ambiguo. Transición: "+ Agregar" → cierra drawer, agrega línea al carrito con extras/cantidad elegidos; "✕"/clic afuera → cierra sin agregar.
3. **Revisar carrito** — Panel derecho, siempre visible. Acción: opcional, eliminar línea (✕). Respuesta: total se recalcula en vivo.
4. **Comandar** — Acción: clic "Comandar" (deshabilitado si carrito vacío). Respuesta: `POST /api/caja/registrarPedido`; loading state en el botón ("Enviando..."). Transición: éxito → toast "Pedido #N enviado a cocina" + redirect a `/cajero/metodos-pago?id=N&total=X`; error → toast de error, permanece en ventas con carrito intacto (no se pierde el trabajo).

**Decisión: ¿el producto tiene extras configurados?**
- Sí (ej. Smash Burguer) → clic simple sigue agregando 1 unidad sin extras (ruta rápida no se penaliza); el drawer queda disponible vía "⋯" para quien sí quiera personalizar.
- No (mayoría de productos hoy) → clic simple es la única interacción necesaria; "⋯" abre un drawer mínimo (solo cantidad + notas).

**Edge cases:**

| Escenario | Manejo |
|---|---|
| Catálogo vacío (sin productos activos) | Estado vacío: "No hay productos disponibles. Contacta al administrador." |
| Búsqueda sin resultados | "Sin resultados para '{query}'" + botón "Limpiar búsqueda" |
| Fetch de extras falla (red) | Drawer muestra "No se pudieron cargar los extras" + botón "Reintentar"; cantidad sigue editable, agregar sin extras sigue posible |
| Doble clic rápido en la misma tarjeta | Debounce: cada clic agrega una unidad independiente (comportamiento esperado, no es un bug) |
| `registrarPedido` falla a mitad de un rush | Carrito permanece intacto en el estado local (no se limpia hasta éxito confirmado) — ya es el comportamiento actual, se mantiene |
| Cajero refresca la página con carrito lleno | Hoy se pierde (estado en memoria, no persistido). **Recomendación fuera del layout puro pero relevante:** persistir el carrito en `sessionStorage` — lo marco como hallazgo, no lo resuelvo aquí porque es lógica de estado, no de layout |

**Accesibilidad:**
- Foco: al abrir el drawer, foco va al campo "Cantidad"; al cerrarlo, foco regresa a la tarjeta que lo abrió.
- El total del carrito usa `aria-live="polite"` para anunciar cambios sin interrumpir.
- Toda tarjeta de producto es `<button>` real (no `div` con `onClick`), navegable por Tab, activable con Enter/Space.

---

### Flujo: Cobrar un pedido

**Meta:** el cajero cobra el pedido comandado y cierra la venta.

**Entry points:**
- [x] Redirect automático tras comandar (`?id=&total=` en la URL)
- [x] (Nuevo) "← Volver al pedido" desde aquí regresa a `/cajero/ventas` — el carrito local ya se vació al comandar, así que "volver" no recupera el pedido anterior; el botón debe leerse como "ir a tomar otro pedido / corregir manualmente", no como un verdadero undo. *(Nota de producto, no solo de layout: si se requiere edición real de un pedido ya comandado, eso es una feature de backend nueva — fuera de alcance de este rediseño.)*

**Pasos:**

1. **Confirmar contexto** — Header. El cajero ve "Pedido #N · Cliente" antes de tocar nada — gate de seguridad visual antes de cobrar.
2. **Elegir método de pago** — Igual a hoy.
3. **Ingresar monto (si efectivo)** — Igual a hoy; cambio se calcula en vivo contra el `total` real (ya corregido en este sprint, ver bug del monto fijo en Bs150).
4. **Confirmar cobro** — `POST /api/caja/facturacion`. Éxito → toast + redirect a `/cajero/ventas`. Error → toast, permanece en la pantalla con los datos ingresados intactos.

**Edge cases:**

| Escenario | Manejo |
|---|---|
| Cajero llega a `/cajero/metodos-pago` sin `id`/`total` en la URL (navegación directa) | Mostrar estado de error: "No se encontró el pedido. Vuelve a ventas." + botón a `/cajero/ventas` (hoy: `alert()` bloqueante, debería ser un estado de pantalla, no un alert) |
| Pedido ya pagado (doble submit) | Backend ya responde 409 "El pedido ya fue pagado" — mostrar como toast no bloqueante + redirect automático a ventas tras 2s |

---

## 5. Especificación de componentes (nuevos / modificados)

### Componente: `TopBarCajero`

**Propósito:** barra persistente en las 4 pantallas de `/cajero` con identidad, contexto de turno y acceso a "Cerrar Caja".

**Variantes:**
- `default`: usado en `/cajero/ventas` — incluye selector de Cliente.
- `contexto-pedido`: usado en `/cajero/metodos-pago` — reemplaza Cliente por "Pedido #N · Cliente" + botón "Volver al pedido".
- `simple`: usado en `/cajero` y `/cajero/cierre` — solo identidad + título de pantalla, sin selectores.

**Props:**
```typescript
interface TopBarCajeroProps {
  empleadoNombre: string;
  turnoInicio: string; // ISO date, para calcular duración en vivo
  variant: 'default' | 'contexto-pedido' | 'simple';
  /** Solo variant="default" */
  cliente?: string;
  onClienteChange?: (cliente: string) => void;
  /** Solo variant="contexto-pedido" */
  pedidoId?: string;
  onVolver?: () => void;
  onCerrarCaja: () => void;
}
```

**Estados:** Default | Hover (en inputs/botones) | Focus (anillo `focus:ring-brand-500/30`) | Disabled (cliente no editable mientras `isSubmitting`).

**Responsive:** por debajo de 1024px, el selector de Cliente colapsa a un botón "Detalles del pedido ▾" que abre un popover (no quitar la info, comprimirla).

**Accesibilidad:** `role="banner"`; el timer de turno se actualiza sin robar foco (`aria-live="off"`, es ambiental, no crítico); "Cerrar Caja" siempre alcanzable por Tab como último elemento de la barra.

**Implementation Target:** `nextjs-senior-engineer` · `src/components/caja/TopBarCajero.tsx`

---

### Componente: `ProductCatalogGrid` (reemplaza la Columna 2 actual de `ventas/page.tsx`)

**Propósito:** buscar, filtrar por categoría y seleccionar productos; agregar con un clic.

**Variantes:** `default` (grilla) — no se contempla vista de lista por ahora (no fue pedida).

**Props:**
```typescript
interface ProductCatalogGridProps {
  products: Item[];
  loading: boolean;
  onQuickAdd: (product: Item) => void;       // clic simple: agrega 1, sin extras
  onCustomize: (product: Item) => void;      // "⋯" o long-press: abre drawer
  selectedCategoryDefault?: string;
}
```

**Estados:**

| Estado | Visual | Comportamiento |
|---|---|---|
| Default | Grilla 3-4 columnas según ancho | Búsqueda y filtro activos |
| Loading | Skeletons (ya existe `ProductCardSkeleton`, se reutiliza) | Buscador deshabilitado hasta cargar |
| Vacío (sin productos) | Mensaje centrado + ícono | — |
| Sin resultados de búsqueda | Mensaje + "Limpiar búsqueda" | — |
| Tarjeta: quick-add en curso | Flash verde 200ms + ícono check momentáneo | No bloquea more clics |

**Responsive:** 4 columnas en ≥1280px, 3 en 1024-1279px, 2 por debajo de 1024px (con aviso de que el ancho mínimo recomendado es 1280px, según asunción de hardware).

**Accesibilidad:** buscador con `aria-label="Buscar producto"`; categorías como `role="tablist"`/`role="tab"` con navegación por flechas; cada tarjeta es `<button>` con `aria-label="Agregar {nombre}, Bs {precio}"`.

**Implementation Target:** `nextjs-senior-engineer` · `src/components/caja/ProductCatalogGrid.tsx`

---

### Componente: `PersonalizeDrawer` (reemplaza la Columna 3 fija)

**Propósito:** panel deslizante para definir cantidad, extras y notas antes de agregar al carrito; reemplaza el espacio fijo siempre-reservado por un panel que solo ocupa espacio cuando se usa.

**Props:**
```typescript
interface PersonalizeDrawerProps {
  product: Item | null;        // null = cerrado
  onClose: () => void;
  onConfirm: (selection: { quantity: number; extraIds: string[]; notes: string }) => void;
}
```

**Estados:** Cerrado (no renderizado/translate-x-full) | Abriendo (animación 200ms) | Cargando extras | Extras cargados | Sin extras disponibles | Error al cargar extras.

**Responsive:** en ≥1280px se ancla como panel lateral (384px) sobre el catálogo (no empuja el layout); por debajo de 1024px se convierte en modal de pantalla completa (mismo contenido).

**Accesibilidad:** `role="dialog"` `aria-modal="true"`; `Escape` cierra sin agregar; foco inicial en el campo Cantidad; foco regresa al disparador al cerrar (estándar de diálogo).

**Animaciones:** entrada `slide-in-from-right` 200ms ease-out; salida `slide-out-to-right` 150ms ease-in.

**Implementation Target:** `nextjs-senior-engineer` · `src/components/caja/PersonalizeDrawer.tsx`

---

### Componente: `CartCheckoutPanel` (reemplaza la Columna 1 actual)

**Propósito:** mostrar el pedido en curso y concentrar la acción terminal ("Comandar") con dominancia visual clara sobre "Cancelar".

**Props:** (mismo modelo de datos que hoy: `cart: CartItem[]`, `onRemoveItem`, `onCancelOrder`, `onCommandOrder`, `isSubmitting`)

**Estados:**

| Estado | Visual |
|---|---|
| Carrito vacío | Mensaje "Pedido vacío" + ilustración simple; botón Comandar deshabilitado (`bg-gray-300`) |
| Con ítems | Lista de líneas + subtotal en vivo |
| Enviando pedido | Botón Comandar → spinner + "Enviando...", input de cliente bloqueado |

**Jerarquía visual (corrige H5):** "Comandar" full-width, `bg-brand-500`, `text-lg`, `py-4`. "Cancelar pedido" como link de texto subrayado bajo el botón (`text-sm text-gray-500 underline`), no como botón de igual tamaño — su bajo peso visual es intencional: es una acción rara y destructiva, no debe competir con la acción que se ejecuta en el 100% de los pedidos exitosos.

**Implementation Target:** `nextjs-senior-engineer` · `src/components/caja/CartCheckoutPanel.tsx`

---

## 6. Tokens y decisiones de sistema (reutilizando lo existente en `globals.css`)

No se introduce una paleta nueva — el rediseño usa los tokens ya definidos en el proyecto.

```typescript
// Reutilizados de globals.css — NO crear nuevos valores de marca
const colorRoles = {
  primaryAction: 'brand-500',      // #FF1E00 — "Comandar", "Confirmar Cobro"
  primaryActionHover: 'brand-600', // #FFD700 (hover, ya definido así en el sistema)
  destructive: 'error-500',
  success: 'success-500',          // flash de quick-add, estado "Caja exacta"
  warning: 'warning-500',          // estado "Sobrante/Faltante" en cierre
  surfaceDefault: 'white / gray-950 (dark)',
  surfaceMuted: 'gray-50 / gray-900 (dark)',
  borderDefault: 'gray-200 / gray-800 (dark)',
}
```

### Espaciado específico de este flujo (densidad POS)

```typescript
const cajeroSpacing = {
  cardGap: '0.75rem',        // 12px entre tarjetas de producto — denso pero no apretado
  panelPadding: '1.25rem',   // 20px — padding interno de drawer/checkout panel
  topBarHeight: '3.5rem',    // 56px — fijo en las 4 pantallas para previsibilidad
  minTapTarget: '2.75rem',   // 44px — aplicar SI el hardware resulta táctil (ver §1)
}
```

### Elevación

```typescript
const elevation = {
  topBar: 'shadow-sm sticky top-0 z-30',
  drawer: 'shadow-xl z-40',           // por encima del catálogo, debajo de toasts
  toast: 'z-70',                       // consistente con zIndex.toast del sistema
}
```

### Motion

| Trigger | Animación | Duración | Easing |
|---|---|---|---|
| Quick-add (tarjeta) | flash de borde verde → vuelve a normal | 200ms | ease-out |
| Drawer abre/cierra | slide-in / slide-out lateral | 200ms / 150ms | ease-out / ease-in |
| Total del carrito cambia | sin animación de movimiento, solo cambio de texto (evitar distracción en flujo rápido) | — | — |

---

## 7. Handoff target

**Agente:** `nextjs-senior-engineer`

**Por qué:** el proyecto es Next.js App Router con Route Handlers como backend (`src/app/api/...`), Server/Client Components mixtos, y los componentes nuevos (`TopBarCajero`, `ProductCatalogGrid`, `PersonalizeDrawer`, `CartCheckoutPanel`) son Client Components (`"use client"`) que consumen las API routes ya existentes (`/api/inventarios/productos`, `/api/inventarios/modificadores`, `/api/caja/registrarPedido`, `/api/caja/facturacion`) — no hay necesidad de SSR/SEO aquí (es una herramienta interna autenticada), pero sí de integración directa con el resto del App Router y los Route Handlers del proyecto, que es exactamente el dominio de este agente.

**Criterios de aceptación para la implementación:**
- [ ] `/cajero/ventas` reordenado: catálogo a la izquierda (flexible), carrito+checkout fijo a la derecha (~360px), sin columna de personalización fija.
- [ ] Clic simple en una tarjeta de producto agrega 1 unidad sin extras al carrito sin pasos intermedios.
- [ ] "⋯"/long-press abre `PersonalizeDrawer` con cantidad, extras (si existen) y notas.
- [ ] Buscador + filtro de categoría sobre el catálogo, en vivo, sin botón "buscar".
- [ ] Campo Cliente editable en la barra superior, reemplazando el valor hardcodeado en `handleCommandOrder` (`mesa` queda hardcodeada por ahora, fuera de alcance).
- [ ] Botón "Comandar" visualmente dominante; "Cancelar pedido" degradado a link de texto.
- [ ] `/cajero/metodos-pago` muestra contexto del pedido (N°, cliente) y un botón funcional "Volver al pedido".
- [ ] `/cajero/cierre`: resumen del sistema colapsado por defecto, expandible.
- [ ] Mismo modelo de datos y mismas API routes — este rediseño es de capa de presentación, no requiere cambios de schema ni de endpoints.
- [ ] Sin regresión: el cálculo de totales con extras (ya implementado en `registrarPedido`) sigue siendo la fuente de verdad; el frontend no debe recalcular precios de forma distinta a lo que el backend ya hace.
- [ ] Accesibilidad: foco gestionado en apertura/cierre de drawer, `aria-live` en total, tarjetas como `<button>` reales.
- [ ] Responsive: degradación aceptable hasta 1024px (2 columnas de catálogo, drawer a pantalla completa); por debajo de eso, no es un caso soportado para esta herramienta interna (señalar con un mensaje, no intentar mobile-first).
