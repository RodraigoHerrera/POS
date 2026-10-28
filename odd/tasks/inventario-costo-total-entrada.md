# Costo total o unitario en entradas de inventario

**Objetivo:** al registrar o editar una entrada, permitir cargar el **costo total** (lo que dice la factura) o el **costo unitario**, con un selector. Si se carga el total, el servidor calcula `costo_unit = costo_total / cantidad`.

**Por qué:** las facturas traen el total; calcular el unitario a mano genera errores de carga.

**Alcance:**
- `src/lib/costoEntrada.ts` (nuevo, cálculo puro con `Prisma.Decimal`, redondeo a 6 decimales como `Decimal(18,6)`)
- `src/app/api/inventarios/registrarEntrada/route.ts` (acepta `costo_total` como alternativa a `costo_unitario`)
- `src/lib/entradaEdicion.ts` (`validarEdicionEntrada` acepta `costo_total` + `cantidad`)
- `src/components/inventario/modals/EntradaModal.tsx` y `EditarEntradaForm.tsx` (selector total/unitario + vista previa del unitario)

**Fuera de alcance:** carga masiva CSV; guardar `costo_total` en BD (se sigue derivando de `cantidad × costo_unit`).

**Restricciones:** compatibilidad hacia atrás (`costo_unitario` / `costo_unit` siguen funcionando). Enviar ambos (`costo_total` y unitario) → 400. Total negativo → 400; total 0 → unitario 0.

**Modo TDD:** estricto (configuración global del usuario). Runner: `npx tsx --test <archivo>.test.ts` (node:test).

---

- [x] **T1 — Helper `costoUnitarioDesdeTotal(total, cantidad)`** con tests (RED → GREEN): división exacta, periódica (100/3 → 33.333333), total 0, total negativo / cantidad ≤ 0 / no numérico → error. _Evidencia: RED = módulo inexistente (suite falla); GREEN = 10/10 en `costoEntrada.test.ts`. Incluye `resolverCostoUnitario` (excluyente unit/total, `undefined` si no hay ninguno). Errores son `ValidationError`._
- [x] **T2 — `registrarEntrada` acepta `costo_total`.** Validación de exclusión mutua y cálculo vía T1. _Evidencia: ruta usa `resolverCostoUnitario` (ya cubierto por tests de T1); ambos → 400, ninguno → 400 existente; `tsc`/eslint limpios en el archivo. Sin test de ruta (handler acoplado a sesión/BD)._
- [x] **T3 — Edición acepta `costo_total`.** `validarEdicionEntrada` con tests: requiere `cantidad`; excluyente con `costo_unit`. _Evidencia: RED = 4 fallos nuevos en `entradaEdicion.test.ts` (43 pass / 4 fail); GREEN tras implementar (todas en verde). Comentario de `entradas/[id]/route.ts` actualizado._
- [x] **T4 — UI:** selector "Costo total / Costo unitario" en ambos formularios, vista previa del unitario calculado en vivo.

**Verificación:** tests de `costoEntrada` y `entradaEdicion` en verde; `tsc --noEmit` sin errores; eslint en archivos tocados.

**Progreso:** T1–T4 implementadas. UI: componente compartido `src/components/inventario/CostoEntradaInput.tsx` (selector + vista previa, solo display). `EntradaModal` por defecto "Costo total"; `EditarEntradaForm` por defecto "Costo unitario" y el selector se deshabilita con `cantidad_costo_editables`. Sin commit. Próximo paso: revisión / commit.
