# Feature: dashboard-selector-periodo

## Objective
Let the Administrator switch the admin dashboard between "Mes" (current month) and "Semana" (current week) data.

## Problem / Why
All dashboard widgets are hard-coded to the current calendar month. The user wants a Month/Week selector (chosen over a day-of-week breakdown).

## Scope
- Pure helper `src/lib/periodo.ts`: `type Periodo = "mes" | "semana"`, `parsePeriodo(value)` (default "mes", invalid → "mes"), `rangoPeriodo(periodo, now)` returning current range `{ inicio, fin }` and previous range `{ inicioAnterior, finAnterior }`. Week = Monday 00:00:00.000 to Sunday 23:59:59.999, local time.
- APIs accept `?periodo=mes|semana` (default mes, backward compatible): `/api/ventas/ventaMensual`, `/api/ventas/costoProduccion` (previous period = previous week when semana), `/api/ventas/topProductos`.
- UI: client container on `src/app/(usuario)/admin/(dashboard)/page.tsx` holding the selected period with a Mes/Semana segmented toggle; passes `periodo` to `EcommerceMetrics`, `MonthlyTarget`, top products (via `DashboardAlertasYTop` / `TopProductosCard`). Labels switch ("Mes Actual" ↔ "Semana Actual", "vs. mes anterior" ↔ "vs. semana anterior", top "del mes" ↔ "de la semana").
- Out of scope: `StatisticsChart` (12-month forecast) and stock alerts stay as they are.

## Constraints
- Strict TDD with node:test (`npx tsx --test <file>`), no e2e.
- Keep existing API response shape; add fields only if needed.
- UI copy in Spanish, matching the project.
- Do not touch unrelated uncommitted user changes.

## Tasks
- [x] T1 `periodo.ts` pure helper + tests (RED → GREEN)
- [x] T2 APIs accept `periodo` query param
- [x] T3 Dashboard client container + toggle + widgets consume `periodo` with dynamic labels
- [x] T4 Verification: unit tests, tsc, lint on touched files

## Acceptance criteria
- Toggle defaults to Mes; switching to Semana refetches KPIs, cost card, and top products for the current week.
- Cost card compares against the previous week in Semana mode.
- Calling APIs without `periodo` behaves exactly as before.

## TDD
- Mode: enabled (session config "Strict TDD Mode: enabled"); runner: `npx tsx --test`.

## Progress
- Created 2026-10-24. T1-T4 done 2026-10-24.

## Verification evidence
- RED: `npx tsx --test src/lib/periodo.test.ts` failed before `periodo.ts` existed (module missing, 1 failed).
- GREEN: same command after implementation: 9 pass, 0 fail.
- `npx tsc --noEmit`: no errors.
- `npx eslint <touched files>`: 0 new issues. Pre-existing: `no-explicit-any` in catch of ventaMensual/costoProduccion routes (2 errors), unused imports in EcommerceMetrics (3 warnings).
- Files: src/lib/periodo.ts(+test), 3 API routes, DashboardPeriodo.tsx (new), EcommerceMetrics, MonthlyTarget, TopProductosCard, DashboardAlertasYTop, admin dashboard page.
- API additions: `periodo` field; costoProduccion also returns `costoPctAnterior` alias.
- Not run: manual browser check of the toggle (no e2e per project rule).

## Review
- RDD on (global), but native review skipped for this candidate by explicit user decision (workspace mixed unrelated changes).

## Next step
Manual visual check of the Mes/Semana toggle in the browser; commit when ready.
