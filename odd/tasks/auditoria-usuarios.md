# Auditoría de la vista `/usuarios`

**Objetivo:** corregir los hallazgos de la auditoría de la pantalla de selección de empleado (`/usuarios`) y del ingreso de PIN (`/usuarios/pin`), junto con las APIs que consumen.

**Alcance:**
- `src/app/(full-width-pages)/(auth)/usuarios/page.tsx`
- `src/app/(full-width-pages)/(auth)/usuarios/pin/page.tsx`
- `src/components/auth/UserChoice.tsx`
- `src/app/api/usuarios/route.ts`
- `src/app/api/usuarios/[id]/route.ts`
- `src/app/api/usuarios/id/route.ts`
- `src/lib/rate-limit.ts`
- `src/middleware.ts`
- `src/app/(usuario)/admin/usuarios/page.tsx` (consumidor del listado)

**Modo TDD:** estricto (configuración global del usuario). Runner: el configurado en el proyecto (`*.test.ts`, p. ej. `src/lib/auth.test.ts`).

**Verificación por tarea:** test que reproduce el problema (RED) → corrección (GREEN) → refactor. E2E solo como smoke test bajo demanda.

---

## 🔴 Seguridad

- [x] **SEC-1 — El listado de empleados expone datos personales con solo la sesión de sucursal.**
  ✅ **Hecho:** `GET /api/usuarios` ahora exige `requireEmpleado(["Administrador"])` y toma la sucursal de esa sesión. Nuevo `GET /api/usuarios/kiosco` (`requireSucursal`) que devuelve `empleadosParaKiosco()` (`src/lib/empleadosKiosco.ts`): solo activos, con `id`, `usuario`, `rol` y `fotoUrl`. `UserChoice` usa el endpoint nuevo, ya no filtra en el cliente y se quitó el `console.log(data)` (BUG-4 queda resuelto con esto).
  **Evidencia:** `npx tsx --test src/lib/empleadosKiosco.test.ts` → RED (módulo inexistente) → GREEN 5/5; `tsc --noEmit` y `eslint` sin errores. Pendiente: smoke manual en el navegador.
  `api/usuarios/route.ts:36-62` devuelve `correo`, `celular` y `creado` de todos los empleados (incluidos los inactivos) con solo `tokenSucursal`. `UserChoice.tsx:27` además hace `console.log(data)`. `admin/usuarios/page.tsx:44` consume el mismo endpoint, así que el listado de administración no exige rol de Administrador.
  **Corrección:** separar en un endpoint de kiosco (solo `id`, `usuario`, `rol`; solo los activos, filtrados en el servidor) y uno de administración protegido con `tokenEmpleado` + rol `Administrador`.
  **Aceptación:** el kiosco no recibe datos de contacto ni empleados inactivos; el endpoint de administración devuelve 401/403 sin un `tokenEmpleado` de Administrador.

- [ ] **SEC-2 — Desde una sucursal se puede bloquear a empleados de otra.**
  En `api/usuarios/id/route.ts:65-89` la clave de bloqueo es `emp:pin:<id>`, se chequea antes de validar la sucursal y registra fallos aunque el empleado sea de otra sucursal.
  **Corrección:** usar la clave `emp:pin:<sucursalId>:<id>`, o registrar fallos solo cuando `isTargetValid` es verdadero.
  **Aceptación:** 5 intentos fallidos desde la sucursal A contra un empleado de la sucursal B no bloquean su ingreso desde B.

- [ ] **SEC-3 — El límite de intentos por IP se evade falseando `x-forwarded-for`.**
  `getClientIp` (`rate-limit.ts:200`) confía en el header que envía el cliente.
  **Corrección:** tomar la IP solo del proxy de confianza (configurable) y no del header crudo.
  **Aceptación:** cambiar `x-forwarded-for` en cada request no reinicia el contador.

- [ ] **SEC-4 — Un empleado inactivo permite confirmar si un PIN es correcto.**
  `api/usuarios/id/route.ts:97`: con el PIN correcto responde 403 "no está activo"; con uno incorrecto, 401. Además, ese caso no registra fallo.
  **Corrección:** responder la misma 401 "PIN incorrecto" en ambos casos y registrar el fallo.
  **Aceptación:** el PIN correcto de un empleado inactivo devuelve la misma respuesta que un PIN incorrecto.

## 🟠 Bugs

- [ ] **BUG-1 — La pantalla de selección se rompe si la API responde con error.**
  `UserChoice.tsx:25-26`: sin el chequeo de `res.ok`, `data` es `{message}` y `.filter` (línea 38) lanza `TypeError`.
  **Aceptación:** una respuesta 4xx/5xx muestra un mensaje de error y no rompe la pantalla.

- [ ] **BUG-2 — "Hola, undefined" en la pantalla de PIN.**
  `pin/page.tsx:21-24` no chequea `res.ok`, y sin `id` no redirige.
  **Aceptación:** sin `id`, o con un id inexistente, se redirige a `/usuarios`.

- [ ] **BUG-3 — Un rol desconocido deja al usuario trabado tras un login exitoso.**
  `pin/page.tsx:50-51` solo contempla `Administrador` y `Cajero`.
  **Aceptación:** un rol no contemplado muestra un error claro.

- [x] **BUG-4 — Comparación de `estado` inconsistente.** (resuelto en SEC-1: `esEmpleadoActivo` en el servidor)
  `UserChoice.tsx:38` compara `"activo"`/`"Activo"` a mano; el backend usa `toLowerCase()`. Queda resuelto si SEC-1 mueve el filtro al servidor.

## 🟡 Accesibilidad y experiencia de uso

- [ ] **UX-1 — Las tarjetas de empleado no se pueden usar con teclado.**
  `UserChoice.tsx:44` usa `<div onClick>`. **Corrección:** `<button>` con foco visible.

- [ ] **UX-2 — El input de PIN no está preparado para un TPV táctil.**
  Agregar `inputMode="numeric"`, `autoComplete="off"`, `autoFocus` y `aria-label`.

- [ ] **UX-3 — Faltan los estados de carga, lista vacía y error en la selección de empleado.**

- [ ] **UX-4 — Contraste del texto de las tarjetas.**
  Definir un color de texto explícito sobre `bg-brand-20` / `bg-brand-600` y verificar el contraste WCAG AA.

## ⚪ Limpieza

- [ ] **CLN-1 —** Reemplazar la metadata de la plantilla ("Next.js SignUp Page | TailAdmin") en `usuarios/page.tsx:5`.
- [ ] **CLN-2 —** Renombrar el componente `usuarios` a PascalCase (`usuarios/page.tsx:10`).
- [ ] **CLN-3 —** Eliminar el estado `nombre`, que no se usa (`pin/page.tsx:9`).
- [ ] **CLN-4 —** Quitar el log de los payloads JWT completos en `middleware.ts:93-99`.

---

## Lo que ya está bien (no tocar)

- El borrado de `tokenEmpleado` al entrar a `/usuarios` (SEC-02, en el middleware).
- `DUMMY_HASH`, que evita que el tiempo de respuesta delate qué empleados existen.
- El filtro por sucursal en `/api/usuarios/[id]`.
- Las cookies `httpOnly` + `sameSite: strict`.

## Progreso

- Prioridad sugerida: SEC-1 → SEC-2 → BUG-1/BUG-2 → SEC-3/SEC-4 → UX → limpieza.
- SEC-1 y BUG-4 hechos.
- Siguiente paso: SEC-2.
