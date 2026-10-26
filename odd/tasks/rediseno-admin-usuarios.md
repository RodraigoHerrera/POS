# Feature: rediseno-admin-usuarios

## Objective
Improve the design of `/admin/usuarios` without leaving the system visual style (TailAdmin: rounded-2xl cards, Badge, brand initials avatar).

## Scope
- Page header with primary action, team summary (total / active / admins), empty state.
- Employee row: initials avatar, name + @usuario, role/status badges, contact info.
- Edit modal: role and status as selects instead of free text.
- Create modal: correct title, password confirmation validated.

## Constraints
- No new fonts/palettes; reuse Badge, Button, Modal, Input, Label.
- TDD: strict, runner `npx tsx --test`.

## Tasks
- [x] T1 `resumenUsuarios` pure helper + tests (RED → GREEN)
- [x] T2 Redesign `UserMetaCard` row + edit modal selects
- [x] T3 Redesign page header, summary, skeleton, empty state, create modal fixes
- [x] T4 Typecheck + tests

## Verification
- `npx tsx --test src/lib/usuariosAdmin.test.ts`
- `npx tsc --noEmit -p .` (filtered to touched files)

## Progress
All tasks done. Extra fix: `Button` gained an optional `type` prop because "Cerrar" inside forms submitted them.
Evidence: 36/36 tests pass (usuariosAdmin, contrasenaEmpleado, empleadosKiosco); tsc clean on touched files; ESLint clean.
Pending: visual check in the browser (not run).
Engram mirror: pending.
