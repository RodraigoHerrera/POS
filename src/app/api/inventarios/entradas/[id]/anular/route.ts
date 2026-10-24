import { NextResponse } from "next/server";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import { parsePositiveBigInt } from "@/lib/validation";
import { runWithRetry } from "@/lib/transactionRetry";
import {
  validarAnulacionEntrada,
  ejecutarAnulacionEntradaTx,
  mapearErrorAnulacion,
} from "@/lib/entradaAnulacion";

// POST /api/inventarios/entradas/[id]/anular
// { motivo? }
// Anula (soft void) una entrada manual de la sucursal de la sesión: revierte el
// stock y el costo promedio y conserva el historial. Toda la lógica vive en
// src/lib/entradaAnulacion.ts (locks, reglas, auditoría).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    const { id } = await params;
    const movimientoId = parsePositiveBigInt(id, "id");
    const body = await req.json().catch(() => null);
    const { motivo } = validarAnulacionEntrada(body);

    await runWithRetry(
      (tx) =>
        ejecutarAnulacionEntradaTx(tx, {
          movimientoId,
          sucursalId: BigInt(sesion.sucursalId),
          empleadoId: BigInt(sesion.empleadoId),
          motivo,
        }),
      { timeoutMs: 15000 }
    );

    return NextResponse.json({ success: true, message: "Entrada anulada correctamente" });
  } catch (error: unknown) {
    const { status, body } = mapearErrorAnulacion(error);
    if (status === 500) console.error(error);
    return NextResponse.json(body, { status });
  }
}
