# Feature: reporte-ventas

## Objective
Admin module at `/admin/reporte-ventas` to download CSV sales reports for a date range: by user, by cash register (caja), by product (summary or detailed), and voided sales.

## Problem / Why
The admin has no way to export sales data for management (performance per employee, cash reconciliation per shift, product profitability, void control). The sidebar already links `/admin/reporte-ventas` (uncommitted user change) but the page does not exist.

## Scope
- Pure helpers `src/lib/reporteVentas.ts` (+ `reporteVentas.test.ts`):
  - `parseRangoFechas(desde, hasta, tz)`: validates `YYYY-MM-DD`, `desde <= hasta`, max 366 days; returns UTC `{ inicio, fin }` (fin exclusive = start of day after `hasta`) using business TZ (`obtenerZonaMrp` / `inicioDiaLocal` from `src/lib/mrp/zonaHoraria.ts`). Invalid → typed error.
  - `generarCSV(cabeceras, filas)`: project convention = UTF-8 BOM + `,` separator + CRLF; RFC 4180 quoting (comma, quote, CR/LF); numbers with 2 decimals; null → empty; formula-injection guard (prefix `'` for cells starting with `= + - @` that are strings).
  - `formatearFechaLocal(date, tz)` → `YYYY-MM-DD HH:mm` in business TZ.
  - Row builders (pure, unit tested): `filasPorUsuario`, `filasProductoResumen`, `filasProductoDetalle`, `filasPorCaja`, `filasAnuladas`.
- API `GET /api/admin/reportes/ventas?tipo=usuario|caja|producto-resumen|producto-detalle|anuladas&desde=&hasta=` → `text/csv` attachment `reporte_<tipo>_<desde>_<hasta>.csv`. Administrator only, branch scoped (`sesion.sucursalId`). 400 on invalid params (JSON `{ message }`).
- Data sources:
  - usuario / producto: `historialVentas` filtered by `fecha_venta` in range + `sucursal_id` (void deletes rows, so only valid sales). User = `empleado_id` (employee who registered the order), joined to `empleados` for name/usuario/rol.
  - caja: `caja` with `fecha_apertura` in range; sales per payment method from `factura` (pedido `PAGADO`, `caja_id` in set) using `METODO_A_COLUMNA` from `src/lib/caja.ts`; manual cash in/out from `movimientoCaja` origen `MANUAL`; stored close data (saldo_final, diferencias, declarados, observaciones).
  - anuladas: `pedido` estado `ANULADO`, `creado_en` in range, with empleado, caja→cajero, factura.
- UI: `src/app/(usuario)/admin/reporte-ventas/page.tsx` (server, `requireEmpleado(["Administrador"])`, redirect `/usuarios`) + `ReporteVentasClient.tsx`: date range inputs + presets (Hoy, 7 días, Mes actual, Mes anterior), one card per report with description and download button; producto card has Resumen/Detallado toggle. Download via fetch → blob; errors via `sonner` toast. UI copy in Spanish.
- Out of scope: charts, other report modules in sidebar (gastos, inventario, compras, cajas), existing empty `admin/reportes` page.

## CSV columns
- usuario: Empleado ID, Nombre, Usuario, Rol, Pedidos, Unidades, Venta total, Costo total, Margen, Margen %, Ticket promedio.
- producto-resumen: Producto ID, Producto, SKU, Categoría, Unidades, Precio promedio, Venta total, Costo real, Costo teórico, Brecha (real-teórico), Margen, Margen %, % de la venta.
- producto-detalle: Fecha, Pedido, Factura, Producto, SKU, Categoría, Cantidad, Precio unitario, Venta total, Costo real, Costo teórico, Margen, Método de pago, Cliente, Empleado.
- caja: Caja ID, Cajero, Estado, Apertura, Cierre, Saldo inicial, Efectivo, Tarjeta, QR, Transferencia, Gift card, Otros, Total ventas, Tickets, Entradas efectivo, Salidas efectivo, Efectivo esperado, Efectivo contado, Diferencia efectivo, Declarado tarjeta, Diferencia tarjeta, Declarado QR, Diferencia QR, Observaciones.
- anuladas: Pedido, Fecha pedido, Fecha anulación (actualizado_en), Tomado por, Caja, Cajero, Mesa, Cliente, Estaba cobrado (Sí/No), Factura, Método de pago, Total, Observaciones/motivo.

## Constraints
- Strict TDD, runner `npx tsx --test <file>` (node:test). No e2e (project rule).
- Do not touch unrelated uncommitted changes (`src/layout/AppSidebar.tsx`).
- Code/identifiers follow project style (Spanish domain names); UI copy in Spanish.

## Tasks
- [x] T1 `reporteVentas.ts` pure helpers + tests (RED → GREEN)
- [x] T2 API route `/api/admin/reportes/ventas`
- [x] T3 Page + client UI
- [x] T4 Verification: unit tests, `npx tsc --noEmit`, eslint on touched files

## Acceptance criteria
- Each of the 5 report types downloads a CSV for the chosen range, opening correctly in Excel (accents preserved).
- Range uses business TZ days; invalid/missing range returns 400 and the UI shows the error.
- Only Administrator; data restricted to the admin's branch.

## TDD
- Mode: enabled (session config "Strict TDD Mode: enabled"); runner: `npx tsx --test`.

## Progress
- Created 2026-10-29.
- T1-T4 implemented 2026-10-29: src/lib/reporteVentas.ts(+test), src/app/api/admin/reportes/ventas/route.ts, src/app/(usuario)/admin/reporte-ventas/{page,ReporteVentasClient}.tsx.
- Decisions: counts (Pedidos, Unidades, Tickets, IDs) emitted as integer strings, money/percent as numbers with 2 decimals; presets in the UI use the browser local date, server interprets range in MRP business TZ; METODO_A_COLUMNA reused from src/lib/caja.ts.

## Verification evidence
- RED: npx tsx --test src/lib/reporteVentas.test.ts before implementation -> 1 fail (module ./reporteVentas not found).
- GREEN: same command after implementation -> 30 tests, 30 pass, 0 fail.
- npx tsc --noEmit: no errors.
- npx eslint (lib, test, route, page dir): no output (clean).
- Not run: manual browser/DB smoke test of the route (no e2e per project rule).

## Next step
Manual smoke test by the user (all 5 downloads) and review; commit pending.
