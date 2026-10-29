import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";
import { calcularResumenCaja } from "@/lib/caja";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

// GET /api/caja/movimientos
// Movimientos manuales de efectivo del turno abierto del empleado (más
// recientes primero) y los totales de entradas/salidas.
export async function GET() {
  try {
    const sesion = await requireEmpleado(["Cajero", "Administrador"]);
    if (esRespuestaError(sesion)) return sesion;
    const { sucursalId, empleadoId } = sesion;

    const cajaAbierta = await prisma.caja.findFirst({
      where: {
        sucursal_id: BigInt(sucursalId),
        empleado_id: BigInt(empleadoId),
        estado: "abierta",
      },
    });
    if (!cajaAbierta) {
      return NextResponse.json({ message: "No tienes una caja abierta en esta sucursal" }, { status: 404 });
    }

    const [filas, resumen] = await Promise.all([
      prisma.movimientoCaja.findMany({
        where: { caja_id: cajaAbierta.id, origen: "MANUAL" },
        orderBy: [{ creado_en: "desc" }, { id: "desc" }],
        select: { id: true, tipo: true, monto: true, descripcion: true, creado_en: true },
      }),
      calcularResumenCaja(cajaAbierta),
    ]);

    return NextResponse.json(
      serializeBigInt({
        movimientos: filas.map((m) => ({
          id: m.id,
          tipo: m.tipo === "INGRESO" ? "ENTRADA" : "SALIDA",
          monto: Number(m.monto),
          razon: m.descripcion,
          creado_en: m.creado_en,
        })),
        entradasEfectivo: resumen.entradasEfectivo,
        salidasEfectivo: resumen.salidasEfectivo,
        efectivoEsperado: resumen.efectivoEsperado,
      })
    );
  } catch (error) {
    return errorResponse(error, "Error al obtener los movimientos de caja");
  }
}
