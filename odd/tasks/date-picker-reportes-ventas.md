# Feature: date-picker-reportes-ventas

## Objective
Use the shared `src/components/form/date-picker.tsx` (flatpickr) for the date range in `/admin/reporte-ventas` and `/admin/ventas`.

## Problem / Why
- Both modules use native `<input type="date">`; the system already has a styled flatpickr DatePicker.
- The DatePicker is uncontrolled (`defaultDate` only) and re-initializes whenever an inline `onChange` changes, so period presets could not update it and a range selection would be lost between clicks.

## Scope
- T1 pure helpers `src/lib/rangoFechas.ts`: `formatearDiaLocal(Date)` and `rangoDesdeSeleccion(Date[])` (complete range only), with tests.
- T2 DatePicker: optional controlled `value` (synced via `setDate` / `clear`), `onChange` kept in a ref (no re-init per render), Spanish locale. Backward compatible with `EntradaModal`.
- T3 reporte-ventas: replace the two date inputs with one `mode="range"` picker.
- T4 ventas (`VentasFilters`): replace Desde/Hasta inputs with one range picker; "Histórico" clears it.

## Constraints
- Presets keep working and update the picker.
- TDD: on (user global "Strict TDD Mode: enabled"), runner `npx tsx --test <file>`; UI components have no test runner, checked with tsc + lint.

## Tasks
- [x] T1 rangoFechas helpers + tests
- [x] T2 DatePicker controlled value + stable onChange + Spanish locale
- [x] T3 reporte-ventas range picker (removed the 400 ms debounce: the picker emits complete ranges, no typing)
- [x] T4 ventas range picker

## Acceptance / Checks
- `npx tsx --test src/lib/rangoFechas.test.ts` green; `npx tsc --noEmit`; `npx next lint` on touched files.

## Progress
- T1-T4 done. Checks: rangoFechas tests 5/5, tsc clean, lint clean on touched files (pre-existing: unused `Filter` import in VentasFilters, `any` errors in EntradaModal).
- Pending: browser check (range selection, presets updating the picker, "Histórico" clearing it, dark mode calendar).
