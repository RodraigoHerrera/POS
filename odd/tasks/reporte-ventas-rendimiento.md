# Feature: reporte-ventas-rendimiento

## Objective
Keep the sales report (`/admin/reporte-ventas`) cheap for the database and the browser as data grows across many branches.

## Problem / Why
- Report queries filter by `sucursal_id` + date range, but the tables only have single-column indexes, so MySQL scans rows of every branch in the range.
- The JSON preview returns every row (producto-detalle can reach ~100k rows for 366 days), loading it all in server memory and in the DOM.

## Scope
- T1: composite indexes `historialVentas(sucursal_id, fecha_venta)`, `caja(sucursal_id, fecha_apertura)`, `pedido(sucursal_id, estado, creado_en)` (schema + hand-written migration).
- T2: cap the JSON preview at `LIMITE_VISTA_PREVIA` (500) rows, returning `total` and `truncado`; producto-detalle uses `take` + `count` in the DB for the preview. CSV stays complete. UI shows "Mostrando N de M filas".

## Constraints
- CSV output unchanged.
- TDD: on (user global config "Strict TDD Mode: enabled"), runner `npx tsx --test <file>`.

## Tasks
- [x] T1 composite indexes + migration `20261029120000_add_reporte_ventas_indexes`
- [x] T2 preview cap (lib helper + route + client)
- [x] T3 debounce date inputs (400 ms); presets query immediately
- [x] T4 usuario / producto-resumen aggregate in DB with `groupBy` (adapters `ventasUsuarioDesdeGrupos`, `ventasProductoDesdeGrupos`); output identical

## Acceptance / Checks
- `npx tsx --test src/lib/reporteVentas.test.ts` green; `npx tsc --noEmit`; `npx next lint`; `npx prisma validate`.
- Migration not applied to any DB here (user applies with `prisma migrate deploy`).

## Progress
- T1-T4 done. Checks: tests 39/39 pass, tsc clean, prisma validate ok, lint clean on touched code (one user-edit warning: unused FileSpreadsheet import).
- Pending: apply migration with `npx prisma migrate deploy`; browser check not run.

## Next step
- None planned. Optional later: stream large CSV exports.
