# 🛡️ Checklist de Seguridad y Remediación de Vulnerabilidades - Smash POS

> **Guía de uso**: Este documento registra las vulnerabilidades detectadas durante la auditoría integral del sistema. A medida que vayamos resolviendo cada vulnerabilidad, marcaremos los casilleros con `[x]` e incluiremos el commit de resolución.

---

## 🔴 Fase 1: Vulnerabilidades Críticas (Riesgo Inmediato de Operación y Seguridad)

- [x] **SEC-01: Desincronización Cross-Tenant (Escalamiento de Privilegios)**
  - **Archivos:** [`src/lib/auth.ts`](file:///D:/cod/smashPOS/POS/src/lib/auth.ts), [`src/app/api/usuarios/id/route.ts`](file:///D:/cod/smashPOS/POS/src/app/api/usuarios/id/route.ts), [`src/app/api/usuarios/info/route.ts`](file:///D:/cod/smashPOS/POS/src/app/api/usuarios/info/route.ts) y [`src/middleware.ts`](file:///D:/cod/smashPOS/POS/src/middleware.ts)
  - **Problema:** `tokenEmpleado` no contiene `sucursalId`. `obtenerSesionEmpleado()` valida ambas firmas criptográficas por separado pero no valida que el empleado pertenezca a la sucursal del `tokenSucursal`.
  - **Acción:** Incorporar obligatoriamente `sucursalId` en el payload de `tokenEmpleado` y verificar estricta concordancia (`payloadEmpleado.sucursalId === payloadSucursal.sucursalId`).
  - **Solución implementada:** Se incluyó obligatoriamente `sucursalId: sucursalId.toString()` en el payload del JWT `tokenEmpleado` emitido en `src/app/api/usuarios/id/route.ts`. En `src/lib/auth.ts`, `obtenerSesionEmpleado()` extrae `sucursalId` de `tokenEmpleado` y valida concordancia estricta y segura contra tipos de objeto/inyección (`typeof === 'string' | 'number'`) contra `sucursalId` de `tokenSucursal`, retornando `null` si no coincide o no existe. En `src/middleware.ts`, se implementó la validación de concordancia entre tokens para rutas protegidas (`/admin`, `/cajero`), purgando la cookie `tokenEmpleado` ante cualquier desincronización o token expirado/inválido, así como la purga preventiva inmediata en la pantalla `/usuarios`. Se refactorizó `src/app/api/usuarios/info/route.ts` para usar `requireEmpleado()` y aislar el endpoint contra tokens cruzados. Suite de pruebas unitarias implementada en `src/lib/auth.test.ts` (28 pruebas pasando).
  - **Commit:** Resuelto

- [ ] **SEC-02: Falso Cierre de Sesión en Terminal Física Compartida**
  - **Archivos:** [`src/components/header/UserDropdown.tsx`](file:///D:/cod/smashPOS/POS/src/components/header/UserDropdown.tsx) y [`src/app/(usuario)/cajero/cierre/page.tsx`](file:///D:/cod/smashPOS/POS/src/app/(usuario)/cajero/cierre/page.tsx)
  - **Problema:** Los botones "Cerrar sesión" y "Salir" solo ejecutan navegación a `/usuarios` sin llamar a la API de logout ni destruir la cookie `tokenEmpleado`.
  - **Acción:** Conectar ambos flujos a `fetch("/api/auth/logout", { method: "POST" })` para limpiar cookies antes de redirigir.
  - **Commit:** *Pendiente*

- [ ] **SEC-03: Deadlocks en InnoDB (P2034) en Pedidos Concurrentes**
  - **Archivos:** [`src/app/api/caja/registrarPedido/route.ts`](file:///D:/cod/smashPOS/POS/src/app/api/caja/registrarPedido/route.ts) y [`src/app/api/caja/editarPedido/route.ts`](file:///D:/cod/smashPOS/POS/src/app/api/caja/editarPedido/route.ts)
  - **Problema:** Bloqueos desordenados sobre `stockLoteSucursal` e `inventarioSucursal` causan error de Deadlock (Error 1213 / P2034) cuando varias mesas compran productos cruzados simultáneamente.
  - **Acción:** Ordenar deterministamente los lotes e insumos por `id` ascendente (`.sort((a, b) => (a.id < b.id ? -1 : 1))`) antes de mutar la base de datos.
  - **Commit:** *Pendiente*

- [ ] **SEC-04: Race Condition: Edición vs. Cobro de Pedidos (Facturas Vacías)**
  - **Archivos:** [`src/app/api/caja/editarPedido/route.ts`](file:///D:/cod/smashPOS/POS/src/app/api/caja/editarPedido/route.ts) y [`src/app/api/caja/facturacion/route.ts`](file:///D:/cod/smashPOS/POS/src/app/api/caja/facturacion/route.ts)
  - **Problema:** En `editarPedido`, la verificación de estado está fuera de la transacción. Si se cobra mientras se edita, se pueden generar facturas fiscales vacías (`detalle_items: []`) y revertir un pedido pagado a comandado.
  - **Acción:** Mover la verificación dentro de la transacción con guarda atómica: `where: { id, estado: { notIn: ["PAGADO", "ANULADO"] } }`.
  - **Commit:** *Pendiente*

- [ ] **SEC-05: Corrupción del Costo Promedio Ponderado (`costo_promedio`) en Entradas**
  - **Archivos:** [`src/app/api/inventarios/registrarEntrada/route.ts`](file:///D:/cod/smashPOS/POS/src/app/api/inventarios/registrarEntrada/route.ts)
  - **Problema:** `findFirst` no bloqueante previo al cálculo del costo en memoria sufre de *Lost Update* ante entradas concurrentes, falseando la valuación del inventario.
  - **Acción:** Migrar a `upsert` o utilizar bloqueo de fila (`SELECT ... FOR UPDATE`) para que el cálculo ponderado sea atómico.
  - **Commit:** *Pendiente*

- [ ] **SEC-06: RCE Crítico en Next.js bajo Windows y Optimización de Imágenes**
  - **Archivos:** [`package.json`](file:///D:/cod/smashPOS/POS/package.json)
  - **Problema:** `next@15.1.12` contiene vulnerabilidades críticas de ejecución remota de código en servidores Windows ([GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36)) y en el optimizador de imágenes SVG/AVIF ([GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw)).
  - **Acción:** Actualizar la dependencia `next` a `>= 15.5.28` o la versión parcheada más reciente de Next.js 15.
  - **Commit:** *Pendiente*

---

## 🟠 Fase 2: Vulnerabilidades de Severidad Alta (Control de Acceso, Validación y Datos)

- [ ] **SEC-07: Estandarización de RBAC en APIs de Caja (Bypass de `requireEmpleado`)**
  - **Archivos:** [`caja/apertura`](file:///D:/cod/smashPOS/POS/src/app/api/caja/apertura/route.ts), [`caja/cerrar`](file:///D:/cod/smashPOS/POS/src/app/api/caja/cerrar/route.ts), [`caja/editarPedido`](file:///D:/cod/smashPOS/POS/src/app/api/caja/editarPedido/route.ts), [`caja/facturacion`](file:///D:/cod/smashPOS/POS/src/app/api/caja/facturacion/route.ts), [`caja/registrarPedido`](file:///D:/cod/smashPOS/POS/src/app/api/caja/registrarPedido/route.ts), [`caja/resumen`](file:///D:/cod/smashPOS/POS/src/app/api/caja/resumen/route.ts)
  - **Problema:** 6 rutas transaccionales decodifican JWT manualmente sin verificar si el rol es Cajero o Administrador.
  - **Acción:** Refactorizar los 6 endpoints para utilizar centralizadamente `requireEmpleado(["Cajero", "Administrador"])`.
  - **Commit:** *Pendiente*

- [ ] **SEC-08: Eliminación de Código Muerto: Cookie `tokenCaja`**
  - **Archivos:** [`src/app/api/caja/apertura/route.ts`](file:///D:/cod/smashPOS/POS/src/app/api/caja/apertura/route.ts) y [`src/app/api/caja/cerrar/route.ts`](file:///D:/cod/smashPOS/POS/src/app/api/caja/cerrar/route.ts)
  - **Problema:** `caja/apertura` emite una cookie `tokenCaja` y `caja/cerrar` la borra, pero ningún endpoint del sistema la consume (el estado real vive en la tabla `caja`).
  - **Acción:** Eliminar la emisión y borrado de `tokenCaja`, eliminando también el `console.log("Token generado:", cajaToken)` que filtra JWTs a logs.
  - **Commit:** *Pendiente*

- [ ] **SEC-09: Filtración de Hashes Bcrypt en Respuestas JSON**
  - **Archivos:** [`src/app/api/auth/register/route.ts`](file:///D:/cod/smashPOS/POS/src/app/api/auth/register/route.ts) y [`src/app/api/auth/registerAdmin/route.ts`](file:///D:/cod/smashPOS/POS/src/app/api/auth/registerAdmin/route.ts)
  - **Problema:** Ambas rutas retornan el registro completo de Prisma al crear sucursales o administradores, exponiendo `contrasena: hashedPassword`.
  - **Acción:** Utilizar `select` explícito en Prisma excluyendo el campo `contrasena` de las respuestas.
  - **Commit:** *Pendiente*

- [ ] **SEC-10: Evasión de Rate Limiting por Spoofing de `X-Forwarded-For`**
  - **Archivos:** [`src/lib/rate-limit.ts`](file:///D:/cod/smashPOS/POS/src/lib/rate-limit.ts)
  - **Problema:** `getClientIp()` confía ciegamente en el primer valor de `X-Forwarded-For` enviado por el cliente, permitiendo eludir los bloqueos de IP en login y PIN.
  - **Acción:** Validar encabezados de proxy solo si provienen de proxies configurados o usar la IP directa provista por el runtime.
  - **Commit:** *Pendiente*

- [ ] **SEC-11: Cotas No Negativas en Precios, Cantidades y Arqueos**
  - **Archivos:** [`modificarModificadores`](file:///D:/cod/smashPOS/POS/src/app/api/inventarios/modificarModificadores/route.ts), [`modificarReceta`](file:///D:/cod/smashPOS/POS/src/app/api/inventarios/modificarReceta/route.ts), [`productos/editar`](file:///D:/cod/smashPOS/POS/src/app/api/inventarios/productos/editar/route.ts), [`caja/cerrar`](file:///D:/cod/smashPOS/POS/src/app/api/caja/cerrar/route.ts)
  - **Problema:** `Number(-50) || 0` permite modificadores con precios negativos o recetas con cantidades negativas.
  - **Acción:** Forzar validación estricta: `precio >= 0`, `cantidad > 0`, `totalContado >= 0`.
  - **Commit:** *Pendiente*

- [ ] **SEC-12: Inconsistencia Fiscal en Anulación de Ventas**
  - **Archivos:** [`src/app/api/admin/ventas/[id]/anular/route.ts`](file:///D:/cod/smashPOS/POS/src/app/api/admin/ventas/%5Bid%5D/anular/route.ts) y [`prisma/schema.prisma`](file:///D:/cod/smashPOS/POS/prisma/schema.prisma)
  - **Problema:** Al anular una venta cobrada, se anula el pedido pero la tabla `factura` queda intacta (sigue viva para tributación).
  - **Acción:** Agregar campo `estado` (`EMITIDA` / `ANULADA`) y `fecha_anulacion` en el modelo `factura`.
  - **Commit:** *Pendiente*

- [ ] **SEC-13: Falta de Bloqueo Atómico en Mermas**
  - **Archivos:** [`src/app/api/inventarios/mermas/route.ts`](file:///D:/cod/smashPOS/POS/src/app/api/inventarios/mermas/route.ts)
  - **Problema:** Se descuenta stock de lote con `update` directo sin verificar `where: { cantidad: { gte: aDescontar } }`, pudiendo provocar stock negativo.
  - **Acción:** Usar `updateMany` atómico con guarda `gte` y revertir si `count === 0`.
  - **Commit:** *Pendiente*

- [ ] **SEC-14: Limpieza de Secretos y Volcados en Workspace y Git**
  - **Archivos:** [`backup_smash_20261019_174512.sql`](file:///D:/cod/smashPOS/POS/backup_smash_20261019_174512.sql) e historial Git (`.env`)
  - **Problema:** El volcado local contiene hashes y ventas reales de la sucursal Univalle. El historial de Git expone credenciales previas de MySQL.
  - **Acción:** Rotar `JWT_SECRET` a clave segura (>= 32 caracteres / 256 bits), rotar contraseña de MySQL, eliminar archivos `.sql` locales del workspace.
  - **Commit:** *Pendiente*

---

## 🟡 Fase 3: Severidad Media y Calidad Arquitectónica

- [ ] **SEC-15: Manejo Seguro de `BigInt` en Rutas Dinámicas (Evitar 500)**
  - **Archivos:** 16 rutas con `BigInt(params.id)`
  - **Problema:** Entradas no numéricas disparan `SyntaxError` no capturado, devolviendo HTTP 500 en lugar de 400.
  - **Acción:** Implementar un helper `parseBigIntParam()` que valide y responda `400 Bad Request`.
  - **Commit:** *Pendiente*

- [ ] **SEC-16: Cabeceras HTTP de Seguridad y Activación de ESLint en Build**
  - **Archivos:** [`next.config.ts`](file:///D:/cod/smashPOS/POS/next.config.ts)
  - **Problema:** Ausencia de cabeceras contra Clickjacking (`X-Frame-Options: DENY`), MIME Sniffing y `eslint: { ignoreDuringBuilds: true }`.
  - **Acción:** Configurar `headers()` en `next.config.ts` y corregir errores de ESLint para eliminar `ignoreDuringBuilds`.
  - **Commit:** *Pendiente*

- [ ] **SEC-17: Reestructuración REST de Rutas en Conflicto**
  - **Archivos:** [`src/app/api/usuarios/id/route.ts`](file:///D:/cod/smashPOS/POS/src/app/api/usuarios/id/route.ts) y [`src/app/api/usuarios/[id]/route.ts`](file:///D:/cod/smashPOS/POS/src/app/api/usuarios/%5Bid%5D/route.ts)
  - **Problema:** Conflicto semántico en Next.js App Router entre la carpeta estática `id` y la dinámica `[id]`.
  - **Acción:** Renombrar `POST /api/usuarios/id` a `/api/auth/pin`.
  - **Commit:** *Pendiente*

- [ ] **SEC-18: Normalización de Ciclo de Vida de Tokens**
  - **Archivos:** [`src/app/api/auth/login/route.ts`](file:///D:/cod/smashPOS/POS/src/app/api/auth/login/route.ts) y [`src/app/api/auth/register/route.ts`](file:///D:/cod/smashPOS/POS/src/app/api/auth/register/route.ts)
  - **Problema:** Discrepancia entre 12h (login) y 8h (registro) en `tokenSucursal`, provocando expiraciones prematuras a mitad de turno.
  - **Acción:** Unificar la vigencia de la sucursal (ej. 12h o 24h continuas) en ambos endpoints.
  - **Commit:** *Pendiente*

- [ ] **SEC-19: Unificación de Librerías JWT sobre `jose`**
  - **Archivos:** [`package.json`](file:///D:/cod/smashPOS/POS/package.json) y rutas API
  - **Problema:** Coexisten `jose` y `jsonwebtoken`. `jsonwebtoken` arrastra vulnerabilidad [GHSA-869p-cjfg-cm3x](https://github.com/advisories/GHSA-869p-cjfg-cm3x).
  - **Acción:** Desinstalar `jsonwebtoken` y migrar todas las firmas/verificaciones a `jose`.
  - **Commit:** *Pendiente*

- [ ] **SEC-20: Resolución de Peer Dependencies y Versionado de Lockfile**
  - **Archivos:** [`package.json`](file:///D:/cod/smashPOS/POS/package.json) y [`.gitignore`](file:///D:/cod/smashPOS/POS/.gitignore)
  - **Problema:** `package-lock.json` está ignorado en Git para evitar el error `ELSPROBLEMS` con React 19, dejando instalaciones no deterministas.
  - **Acción:** Resolver dependencias con `overrides` en `package.json`, eliminar `package-lock.json` de `.gitignore` y versionarlo.
  - **Commit:** *Pendiente*
