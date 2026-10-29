# Feature: rediseno-admin-menu

## Objective
Make `/admin/menu` (product catalog) faster to manage for the admin, keeping the system visual style (TailAdmin: rounded-2xl cards, Badge, Button, Modal, Input, Label).

## Problem
Flat grid with no search, filters or summary; editing status requires opening a modal; product photos never render (API returns `imagenUrl`, client reads `fotoUrl`); no error or empty state.

## Scope
- Header with summary (total / active / inactive).
- Toolbar: search by name, category chips, status filter.
- Product row card: photo, name, category, price, status badge, quick "visible in POS" toggle, edit button.
- Edit modal: category with suggestions (datalist), price with Bs. prefix, description textarea, styled status select.
- Loading skeleton, error with retry, empty and no-results states.

## Constraints
- No new fonts/palettes; reuse existing UI components.
- No API changes.
- TDD: strict, runner `npx tsx --test`.

## Tasks
- [x] T1 `menuAdmin` pure helpers (resumen, categorias, filtrar) + tests (RED → GREEN)
- [x] T2 Redesign `ProductosCard` (row layout, quick status toggle, edit modal)
- [x] T3 Redesign `/admin/menu` page (header, summary, toolbar, states)
- [x] T4 Typecheck + lint + tests

## Verification
- `npx tsx --test src/lib/menuAdmin.test.ts`
- `npx tsc --noEmit -p .` (filtered to touched files)
- `npx eslint` on touched files

## Progress
All tasks done.
- Extra: `Input` gained optional `required` and `list` props (for the category datalist).
- Fix: photos now read `imagenUrl` (API field); rendered with `<img>` because `next.config` has no `remotePatterns`.
- Skeleton only on first load, so reloading after a toggle/save keeps the list and scroll.
Evidence: RED observed (module missing) → 8/8 menuAdmin + 18 usuariosAdmin pass; tsc clean on touched files; ESLint clean.
Pending: visual check in the browser (not run).
Engram mirror: pending.
