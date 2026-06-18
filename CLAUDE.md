# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Smash POS — a POS/ERP for a fast-casual restaurant (Smash Burger). Next.js (App Router, TypeScript, React 19) frontend + API routes, Prisma ORM, MySQL 8.x database. Built on the "TailAdmin" free Next.js admin dashboard template, so much of `src/components/` and `src/layout/` is template UI not specific to POS logic.

## Commands

```bash
npm install --legacy-peer-deps   # required due to template's peer-dep conflicts
npm run dev                      # dev server at http://localhost:3000
npm run build
npm start
npm run lint                     # next lint

npx prisma generate               # regenerate Prisma client after schema changes
npx prisma migrate dev --name <change>   # create + apply a migration
npx prisma studio                 # DB GUI
```

There is no test suite configured.

## Architecture

### Auth flow (two-stage JWT)
Login is **Sucursal → Empleado → PIN**, not a single user login:
1. `/api/auth/login` validates sucursal (branch) credentials, issues `tokenSucursal` JWT cookie (httpOnly, 8h).
2. After picking an employee and entering a PIN, a second token `tokenEmpleado` is issued and stored as its own cookie.
3. `src/middleware.ts` guards `/admin`, `/cajero`, `/usuarios`: requires a valid `tokenSucursal` for all of them, and additionally a valid `tokenEmpleado` for `/admin` and `/cajero`. Missing/invalid tokens redirect to `/` (no sucursal) or `/usuarios` (no empleado).
4. JWTs are signed with `jsonwebtoken` in API routes but verified with `jose` (`jwtVerify`) in middleware and route handlers — both use `process.env.JWT_SECRET`.
5. Route handlers read cookies via `cookies()` from `next/headers` and decode `sucursalId`/`empleadoId` out of the verified payload (fields are sometimes `sucursalId`/`id` or `empleadoId`/`id` — check both).

### Route groups
- `src/app/(usuario)/admin/...` — admin dashboard: inventario, menu, recetas, reportes, usuarios.
- `src/app/(usuario)/cajero/...` — cashier flows: ventas, metodos-pago.
- `src/app/(full-width-pages)/...` — full-width layouts (e.g. login).
- `src/app/api/...` — all backend logic lives here as Next.js Route Handlers (no separate backend).

### Prisma data model (prisma/schema.prisma)
Core domain split across a few clusters:
- **Org**: `sucursales` (branches, also act as the top-level login "user") → `empleados` (employees, roles, PIN-based).
- **Catalog/recipes**: `item` (tipo: vendible/insumo/prep) ← `receta`/`recetaItem` define what insumos make up a vendible item; `modificadorProducto` for extras like "+bacon". `producto` is the menu-facing entity, optionally linked to an `item` via `item_inventario_id`.
- **Inventory**: `inventarioSucursal` (per-branch running stock + avg cost), `lote`/`stockLoteSucursal` (lot/batch tracking per branch for FEFO — first-expired-first-out), `movimientoInventario` (kardex/ledger of all stock movements with tipo/motivo enums).
- **Purchasing**: `proveedor`, `ordenCompra`/`ordenCompraItem`.
- **Production**: `produccion`/`produccionItem` — converts insumos into prep items via lot consumption/generation.
- **Sales/POS**: `caja` (cash-register shift/session with opening/closing balances per payment method) → `pedido` (order/comanda, has `EstadoPedido` lifecycle: PENDIENTE → COMANDADO → PREPARADO → ENTREGADO → PAGADO/ANULADO) → `pedidoItem` (line items, snapshot price/cost) → `pedidoItemExtra`. `factura` is 1:1 with `pedido` and stores a JSON snapshot of sold items for audit. `historialVentas` is a denormalized BI/reporting table populated from completed sales.

### Key business logic pattern: FEFO inventory deduction
When an order is placed (e.g. `src/app/api/caja/registrarPedido/route.ts`), within a single `prisma.$transaction`:
1. Resolve the `producto` → its linked `item` → its `receta` (recipe) → `recetaItem`s (required insumos and quantities).
2. For each insumo, query `stockLoteSucursal` ordered by `lote.fecha_caducidad asc` (FEFO) to find lots to consume.
3. Decrement `stockLoteSucursal.cantidad`, write a `movimientoInventario` row (tipo `Salida`, motivo `Venta`), and decrement the aggregate `inventarioSucursal.stock`.
4. Accumulate `costo_real` on the `pedidoItem` from each lot's `costo_unit` — this is the real (FEFO-based) cost snapshot used later for margin reporting in `historialVentas`.

Any new flow that consumes inventory (production, manual adjustments, etc.) should follow this same FEFO + kardex-write pattern for consistency.

### Conventions / gotchas
- Prisma uses `BigInt` for all IDs. **Convert `BigInt` to `string` before `NextResponse.json()`** — JSON.stringify cannot serialize BigInt natively.
- Monetary/quantity fields are Prisma `Decimal`; convert with `Number(...)` before arithmetic in JS.
- Most models/fields are in Spanish (`sucursales`, `empleados`, `pedido`, `caja`, etc.) — keep naming consistent with the existing schema when adding fields/models.
- `src/lib/db.ts` exports a singleton `prisma` client (standard Next.js dev hot-reload guard) — always import this rather than instantiating a new `PrismaClient`.
- Path alias `@/*` maps to `src/*`.

## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

Using gstack skills: After install, skills like /qa, /ship, /review, /investigate,
and /browse are available. Use /browse for all web browsing.
Use ~/.claude/skills/gstack/... for gstack file paths (the global path).
