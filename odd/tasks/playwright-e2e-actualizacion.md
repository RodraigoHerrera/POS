# Task: Actualización de Suite Playwright E2E

## Objective
Incorporar pruebas E2E en Playwright (`tests/e2e/`) que cubran las nuevas funcionalidades clave del sistema recientemente integradas (Kardex con filtros y exportación CSV, generación automática de lotes, y Reporte de Ventas con descarga y presets de fechas).

## Problem / Why
La suite Playwright (`tests/e2e/`) solo contaba con `demo.spec.ts` y `produccion.spec.ts`. Las funcionalidades añadidas en los últimos PRs (#28-#33: Kardex con responsable, filtros por fecha, feedback de exportación CSV, lote automático, y módulo de Reportes de Ventas) solo se validaron en tests unitarios/smoke y TestSprite, sin cobertura E2E en Playwright.

## Scope
- `tests/e2e/kardex.spec.ts`: Navegación a `/admin/inventario`, apertura del Kardex, verificación de columnas ("Registrado por", "Lote", "Detalle"), filtros de fecha, exportación CSV con validación de toast y descarga, y registro de entrada con código de lote automático.
- `tests/e2e/reporte-ventas.spec.ts`: Navegación a `/admin/reporte-ventas`, conmutación entre tipos de reporte (usuario, cajas, producto, anuladas), selección de presets de fecha, y descarga de CSV con validación de feedback Sonner.
- `playwright.config.ts`: Incrementar timeout de `webServer` a 120s y añadir `stdout: "pipe"` para prevenir timeouts en arranque en frío de Next.js en Windows.

## Constraints
- Reutilizar helpers existentes en `tests/e2e/helpers.ts`.
- No alterar la base de datos de producción/demo fuera de los datos de prueba controlados.
- Preservar compatibilidad con `npm run test:e2e` y el script de demo.

## Tasks
- [x] T1 Ajustar configuración de `webServer` en `playwright.config.ts`.
- [x] T2 Crear spec E2E para Kardex de inventario (`tests/e2e/kardex.spec.ts`).
- [x] T3 Crear spec E2E para Reporte de ventas (`tests/e2e/reporte-ventas.spec.ts`).
- [x] T4 Validar sintaxis y tipos con TypeScript (`npx tsc --noEmit`).
- [x] T5 Ejecutar la suite contra la BD `smash_test` (puerto 3100) y corregir fallos: 1/5 en la primera corrida.
- [x] T6 Corregir `kardex.spec.ts` (toggle "Costo unitario", orden serial para que la exportación tenga datos) y `produccion.spec.ts` (sucursal smoke con "Salsa Smoke", el faltante de insumos ahora se bloquea en el cliente).

## Progress
- 2026-10-30: Creadas suites E2E en Playwright para Kardex (`tests/e2e/kardex.spec.ts`) y Reporte de Ventas (`tests/e2e/reporte-ventas.spec.ts`).
- `playwright.config.ts` ajustado con timeout de 120s y `stdout: "pipe"`.
- `npx tsc --noEmit` completado exitosamente (exit 0).
- 2026-10-30: Primera ejecución real contra `smash_test` (seed smoke + seed demo): 1 passed / 4 failed.
  - Kardex export: 0 movimientos -> toast "No hay movimientos para exportar", sin descarga.
  - Kardex entrada: `CostoEntradaInput` arranca en "Costo total"; el label "Costo unitario" no existe hasta alternar.
  - Producción: la sucursal demo no tiene preparaciones con stock; el caso de insuficiencia ya no es un error del servidor (botón deshabilitado + "Faltan N insumo(s)").
- 2026-10-30: Tras los fixes: 5 passed (3.7m) contra `smash_test`. `demo.spec.ts` excluido (proyecto demo con navegador visible).

## Next step
- Agregar cobertura para rutas sin e2e: `/admin` (dashboard), `/admin/ventas`, `/admin/reportes`, `/cajero/pedidos`, `/cajero/comanda/[id]`.
- Hacer que `npm run test:e2e` apunte a la BD `_test` (hoy `playwright.config.ts` usa el servidor de dev con la BD de dev).
