import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { serializeBigInt } from "@/lib/serialize";
import { calcularResumenCaja } from "@/lib/caja";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import {
  parseNonNegativeNumber,
  ValidationError,
  validationErrorResponse,
} from "@/lib/validation";

// POST /api/caja/cerrar  { totalContado: number, observaciones?: string }
// Cierra la caja abierta del empleado actual: agrega las ventas facturadas
// mientras estuvo abierta (mismo cálculo que /api/caja/resumen, vía
// calcularResumenCaja), calcula la diferencia de efectivo contra lo contado
// físicamente, y marca la caja como "cerrada".
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { totalContado, observaciones } = body;

    // Validación fail-fast de cotas no negativas al inicio del handler
    const validTotalContado = parseNonNegativeNumber(totalContado, "totalContado");

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

    const resumen = await calcularResumenCaja(cajaAbierta);
    const contadoDec = new Prisma.Decimal(validTotalContado.toString());
    const esperadoDec = new Prisma.Decimal(resumen.efectivoEsperado?.toString() || "0");
    const diff = contadoDec.sub(esperadoDec);
    // Tolerancia menor a medio centavo para descartar residuos de coma flotante
    const diferenciaEfectivo = diff.abs().lessThan(0.005) ? 0 : diff.toDecimalPlaces(2).toNumber();

    const cajaCerrada = await prisma.caja.update({
      where: { id: cajaAbierta.id },
      data: {
        estado: "cerrada",
        fecha_cierre: new Date(),
        saldo_final: contadoDec.toDecimalPlaces(2).toNumber(),
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
        totalContado: validTotalContado,
        diferenciaEfectivo,
      })
    );

    // La caja ya no está abierta: la sesión de caja deja de ser válida.
    response.cookies.set("tokenCaja", "", { path: "/", maxAge: 0 });

    return response;
  } catch (error) {
    if (error instanceof ValidationError) {
      return validationErrorResponse(error);
    }
    return errorResponse(error, "Error al cerrar la caja");
  }
}
