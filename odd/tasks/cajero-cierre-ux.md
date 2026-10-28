# Feature: cajero-cierre-ux

## Objective
Redesign `/cajero/cierre` so the cashier closes the register fast and confidently, using the system's existing visual language (as in `/cajero/metodos-pago`).

## Problem / Why
- Single stacked column; card/QR/notes hidden inside a collapsible ABOVE the cash count, out of task order.
- "Confirmar Cierre" sits below 11 denomination rows; requires scrolling.
- Errors use blocking `alert()`.
- The cashier never sees Esperado / Declarado / Diferencia before committing (only on the ticket, after close).
- Typing every denomination count is slow on touch screens.

## Decisions
- Visual direction: utilitarian POS, matching `metodos-pago`: Outfit font, white `rounded-2xl` cards with `border-gray-100 shadow-sm`, brand bar section titles (`bg-brand-500 w-1 h-6 rounded-full`), primary action `bg-red-600 hover:bg-red-700 py-4 rounded-xl shadow-lg shadow-red-500/30 active:scale-[0.98]`, dark mode variants everywhere. No new fonts/palette.
- Live difference: user chose to show the difference live while counting (2026-10-28), not blind count.
- Apertura (`/cajero`) keeps its current behavior; the counting grid is extracted so both share it.

## Scope
- Pure helpers (new `src/lib/conteoCierre.ts`, client-safe, no prisma import): denomination total in cents-safe arithmetic, stepper adjust (never < 0), declared-amount parsing (moved from page), live reconciliation rows (Efectivo/Tarjeta/QR) with status Exacta / Sobrante / Faltante / Pendiente (declared empty).
- `ConteoDenominaciones` controlled grid with − / + touch steppers, editable input, Enter moves focus to next input, accessible labels.
- `DenominacionesForm` (apertura) composes the new grid.
- Cierre page: 2-column layout (lg+): left = ① Efectivo, ② Tarjeta y QR, ③ Observaciones; right = sticky ticket-like live summary + big "Confirmar Cierre" + "Cancelar" text link. Inline errors instead of `alert()`. Mobile: single column, summary + confirm as sticky bottom bar.
- Keep e2e contracts: `#total-tarjeta`, `#total-qr`, button "Confirmar Cierre", `Confirmar Apertura`; update `tests/e2e/helpers.ts` `fillDenominacion` to accessible label selectors if markup changes.
- Out of scope: API changes, ticket after close.

## Constraints
- Strict TDD, runner `npx tsx --test <file>`. Smoke on demand only (needs :3000 dev server stopped).
- UI copy Spanish (project language).

## Tasks
- [x] T1 `src/lib/conteoCierre.ts` + `src/lib/conteoCierre.test.ts` (RED -> GREEN)
- [x] T2 `ConteoDenominaciones` component; `DenominacionesForm` uses it (apertura unchanged in behavior)
- [x] T3 Cierre page redesign + live summary component
- [x] T4 e2e helper selectors; checks: unit tests, tsc, eslint touched files
- [x] T5 Smoke run (`npm run test:smoke`)

## Acceptance criteria
- Confirm button always visible without scrolling on desktop; sticky bottom on mobile.
- Summary updates live: Efectivo esperado vs contado, Tarjeta and QR esperado vs declarado, with status and color.
- Errors inline; no `alert()`.
- Apertura still works (smoke `abrirCaja`).

## TDD
- Mode: enabled (session config "Strict TDD Mode: enabled"); runner: `npx tsx --test`.

## Progress
- Created 2026-10-28. Branch `feat/cajero-cierre-ux`.
- T1-T4 done (uncommitted). T5 (smoke) pending, run by parent.
- Decisions: `ajustarCantidad` returns "" for 0 (placeholder shows). Mobile bottom bar status = first method with Faltante/Sobrante, else "Faltan montos por declarar" / "Todo cuadra". Two "Confirmar Cierre" buttons (sidebar `hidden lg:flex`, bar `lg:hidden`) so only one is visible.

## Verification evidence
- T1 RED: `npx tsx --test src/lib/conteoCierre.test.ts`: 1 failed (module missing). GREEN after implementing: 16 pass, 0 fail.
- `npx tsx --test src/lib/conteoCierre.test.ts src/lib/ticketCierre.test.ts src/lib/caja.test.ts`: 50 pass, 0 fail.
- `npx tsc --noEmit`: exit 0.
- `npx eslint <touched files>`: exit 0.
- Components not unit-tested (no harness); UI behavior pending smoke/manual.

## Visual check and fixes (parent, 2026-10-28)
- Temporary Playwright capture spec (desktop 1280px and mobile 390px, removed afterwards) revealed: (1) count inputs collapsed to ~8px in the 2-column grid (fixed label/buttons/subtotal widths left no room for the `flex-1` input) — fixed: input `w-14 shrink-0`, label `w-16`, subtotal `flex-1 truncate`; (2) on mobile the validation error rendered only in the summary card, off-screen — fixed: bottom bar shows the error (`role="alert"`) instead of the status. Re-captured: digits fully visible, mobile error visible above the confirm button.
- `npx eslint <touched files>`: clean. Unit: 50/50. `npx tsc --noEmit`: clean.
- T5: `npm run test:smoke`: 2 passed (1.8m) on the final code.

## Next step
- PR to main when the user decides.
