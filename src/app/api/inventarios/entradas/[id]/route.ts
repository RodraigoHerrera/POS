import { NextResponse } from "next/server";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import { parsePositiveBigInt } from "@/lib/validation";
import { runWithRetry } from "@/lib/transactionRetry";
import {
  validarEdicionEntrada,
  ejecutarEdicionEntradaTx,
  mapearErrorEdicion,
} from "@/lib/entradaEdicion";

// PATCH /api/inventarios/entradas/[id]
// { codigo_lote?, fecha_caducidad?, referencia?, cantidad?, costo_unit? }
// Edita una entrada manual de la sucursal de la sesión. Metadatos siempre;
// cantidad y costo solo si el lote no tiene otros movimientos. Toda la lógica
// vive en src/lib/entradaEdicion.ts (locks, reglas, auditoría).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    const { id } = await params;
    const movimientoId = parsePositiveBigInt(id, "id");
    const body = await req.json().catch(() => null);
    const solicitud = validarEdicionEntrada(body);

    const resultado = await runWithRetry(
      (tx) =>
        ejecutarEdicionEntradaTx(tx, {
          movimientoId,
          sucursalId: BigInt(sesion.sucursalId),
          empleadoId: BigInt(sesion.empleadoId),
          solicitud,
        }),
      { timeoutMs: 15000 }
    );

    if (resultado.sinCambios) {
      return NextResponse.json({
        success: true,
        sinCambios: true,
        message: "No hubo cambios para guardar",
      });
    }
    return NextResponse.json({
      success: true,
      message: "Entrada actualizada correctamente",
      cambios: resultado.cambios.length,
    });
  } catch (error: unknown) {
    const { status, body } = mapearErrorEdicion(error);
    if (status === 500) console.error(error);
    return NextResponse.json(body, { status });
  }
}
