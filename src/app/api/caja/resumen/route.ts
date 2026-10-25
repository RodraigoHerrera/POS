import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { calcularResumenCaja } from "@/lib/caja";
import { errorResponse } from "@/lib/apiError";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export const dynamic = "force-dynamic";

// GET /api/caja/resumen
// Resumen en vivo de la caja abierta del empleado actual (ventas por método
// de pago, efectivo esperado), SIN cerrarla. Pensado para mostrarse antes de
// contar el efectivo físico en /cajero/cierre.
export async function GET() {
  try {
    const cookieStore = await cookies();
    const tokenSucursal = cookieStore.get("tokenSucursal")?.value;
    const tokenEmpleado = cookieStore.get("tokenEmpleado")?.value;
    if (!tokenSucursal || !tokenEmpleado) {
      return NextResponse.json({ message: "Sesión no válida o expirada" }, { status: 401 });
    }

    let sucursalId: string;
    let empleadoId: string;
    try {
      const payloadSucursal = await jwtVerify(tokenSucursal, secret);
      sucursalId = (payloadSucursal.payload as any)?.sucursalId || (payloadSucursal.payload as any)?.id;

      const payloadEmpleado = await jwtVerify(tokenEmpleado, secret);
      empleadoId = (payloadEmpleado.payload as any)?.empleadoId || (payloadEmpleado.payload as any)?.id;
    } catch {
      return NextResponse.json({ message: "Error verificando tokens" }, { status: 403 });
    }

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
