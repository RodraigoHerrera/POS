import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calcularResumenCaja } from "@/lib/caja";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/caja/resumen
// Resumen en vivo de la caja abierta del empleado actual (ventas por método
// de pago, efectivo esperado), SIN cerrarla. Pensado para mostrarse antes de
// contar el efectivo físico en /cajero/cierre.
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

    const [resumen, empleado] = await Promise.all([
      calcularResumenCaja(cajaAbierta),
      prisma.empleados.findUnique({
        where: { id: BigInt(empleadoId) },
        select: { nombre: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      ...resumen,
      empleadoNombre: empleado?.nombre ?? "",
    });
  } catch (error) {
    return errorResponse(error, "Error al obtener el resumen de caja");
  }
}
