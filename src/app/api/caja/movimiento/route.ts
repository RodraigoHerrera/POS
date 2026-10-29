import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { serializeBigInt } from "@/lib/serialize";
import { calcularResumenCaja } from "@/lib/caja";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import { ValidationError, validationErrorResponse } from "@/lib/validation";
import {
  validarMovimientoCaja,
  puedeRetirar,
  TIPO_MOVIMIENTO_DB,
} from "@/lib/movimientoCaja";

class EfectivoInsuficienteError extends Error {
  constructor(public disponible: number) {
    super(`No hay suficiente efectivo en caja (disponible Bs ${disponible.toFixed(2)})`);
    this.name = "EfectivoInsuficienteError";
  }
}

// POST /api/caja/movimiento
//   { tipo: "ENTRADA" | "SALIDA", monto: number, razon: string }
// Registra un movimiento manual de efectivo en la caja abierta del empleado.
// Una SALIDA no puede superar el efectivo esperado actual en la caja.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    // Validación fail-fast antes de tocar auth o base de datos
    const { tipo, monto, razon } = validarMovimientoCaja(body);

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

    const { movimiento, resumen } = await prisma.$transaction(async (tx) => {
      // Bloquea la fila de la caja para serializar movimientos concurrentes
      await tx.$queryRaw`SELECT id FROM caja WHERE id = ${cajaAbierta.id} FOR UPDATE`;

      if (tipo === "SALIDA") {
        const actual = await calcularResumenCaja(cajaAbierta, tx);
        if (!puedeRetirar(monto, actual.efectivoEsperado)) {
          throw new EfectivoInsuficienteError(actual.efectivoEsperado);
        }
      }

      const creado = await tx.movimientoCaja.create({
        data: {
          caja_id: cajaAbierta.id,
          tipo: TIPO_MOVIMIENTO_DB[tipo],
          monto: new Prisma.Decimal(monto.toString()),
          descripcion: razon,
          origen: "MANUAL",
        },
      });
      return { movimiento: creado, resumen: await calcularResumenCaja(cajaAbierta, tx) };
    });

    return NextResponse.json(
      serializeBigInt({
        success: true,
        movimiento: {
          id: movimiento.id,
          tipo,
          monto,
          razon,
          creado_en: movimiento.creado_en,
        },
        entradasEfectivo: resumen.entradasEfectivo,
        salidasEfectivo: resumen.salidasEfectivo,
        efectivoEsperado: resumen.efectivoEsperado,
      }),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return validationErrorResponse(error);
    }
    if (error instanceof EfectivoInsuficienteError) {
      return validationErrorResponse(error);
    }
    return errorResponse(error, "Error al registrar el movimiento de caja");
  }
}
