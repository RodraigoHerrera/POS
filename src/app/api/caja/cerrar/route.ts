import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { serializeBigInt } from "@/lib/serialize";
import { calcularResumenCaja } from "@/lib/caja";
import { errorResponse } from "@/lib/apiError";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

// POST /api/caja/cerrar  { totalContado: number, observaciones?: string }
// Cierra la caja abierta del empleado actual: agrega las ventas facturadas
// mientras estuvo abierta (mismo cálculo que /api/caja/resumen, vía
// calcularResumenCaja), calcula la diferencia de efectivo contra lo contado
// físicamente, y marca la caja como "cerrada".
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { totalContado, observaciones } = body;

    if (totalContado === undefined || totalContado === null || Number.isNaN(Number(totalContado))) {
      return NextResponse.json({ message: "Falta totalContado" }, { status: 400 });
    }

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

    const resumen = await calcularResumenCaja(cajaAbierta);
    const diferenciaEfectivo = Number(totalContado) - resumen.efectivoEsperado;

    const cajaCerrada = await prisma.caja.update({
      where: { id: cajaAbierta.id },
      data: {
        estado: "cerrada",
        fecha_cierre: new Date(),
        saldo_final: Number(totalContado),
        total_ventas: resumen.totalVentas,
        ventas_efectivo: resumen.ventasPorMetodo.ventas_efectivo,
        ventas_tarjeta: resumen.ventasPorMetodo.ventas_tarjeta,
        ventas_qr: resumen.ventasPorMetodo.ventas_qr,
        ventas_transfer: resumen.ventasPorMetodo.ventas_transfer,
        ventas_giftcard: resumen.ventasPorMetodo.ventas_giftcard,
        ventas_otros: resumen.ventasPorMetodo.ventas_otros,
        diferencia_efectivo: diferenciaEfectivo,
        observaciones: observaciones || cajaAbierta.observaciones,
      },
    });

    const response = NextResponse.json(
      serializeBigInt({
        success: true,
        message: "Caja cerrada correctamente",
        cajaId: cajaCerrada.id,
        totalVentas: resumen.totalVentas,
        ventasPorMetodo: resumen.ventasPorMetodo,
        efectivoEsperado: resumen.efectivoEsperado,
        totalContado: Number(totalContado),
        diferenciaEfectivo,
      })
    );

    // La caja ya no está abierta: la sesión de caja deja de ser válida.
    response.cookies.set("tokenCaja", "", { path: "/", maxAge: 0 });

    return response;
  } catch (error) {
    return errorResponse(error, "Error al cerrar la caja");
  }
}
