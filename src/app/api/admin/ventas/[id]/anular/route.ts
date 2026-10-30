import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;
    const sucursalBigInt = BigInt(sesion.sucursalId);

    const { id } = await context.params;
    let pedidoBigInt: bigint;
    try {
      pedidoBigInt = BigInt(id);
    } catch {
      return NextResponse.json({ error: "ID de pedido inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { motivo, resolucion_inventario } = body;

    if (!motivo || typeof motivo !== "string" || motivo.trim().length < 5) {
      return NextResponse.json(
        { error: "El motivo de anulación es requerido y debe tener al menos 5 caracteres" },
        { status: 400 }
      );
    }

    if (resolucion_inventario !== "REPONER" && resolucion_inventario !== "MERMA") {
      return NextResponse.json(
        { error: "La resolución de inventario debe ser 'REPONER' o 'MERMA'" },
        { status: 400 }
      );
    }

    const resultado = await prisma.$transaction(async (tx) => {
      // a. Fetch order
      const pedido = await tx.pedido.findFirst({
        where: { id: pedidoBigInt, sucursal_id: sucursalBigInt },
        include: { factura: true },
      });

      if (!pedido) {
        throw new Error("Pedido no encontrado");
      }

      if (pedido.estado === "ANULADO") {
        throw new Error("El pedido ya está anulado");
      }

      // b. Atomic state transition
      const notaAnulacion = `ANULADO (Admin #${sesion.empleadoId}): ${motivo.trim()} [Inv: ${resolucion_inventario}]`;
      const transicion = await tx.pedido.updateMany({
        where: {
          id: pedidoBigInt,
          sucursal_id: sucursalBigInt,
          estado: { not: "ANULADO" },
        },
        data: {
          estado: "ANULADO",
          observaciones: pedido.observaciones
            ? `${pedido.observaciones} | ${notaAnulacion}`
            : notaAnulacion,
        },
      });

      if (transicion.count === 0) {
        throw new Error("El pedido ya está anulado");
      }

      // c. Kardex consumption lookup
      const consumos = await tx.movimientoInventario.findMany({
        where: {
          sucursal_id: sucursalBigInt,
          tipo: "Salida",
          motivo: "Venta",
          referencia: `Pedido #${pedidoBigInt}`,
        },
      });

      // d. Inventory resolution
      if (resolucion_inventario === "REPONER") {
        const incrementosPorInsumo = new Map<string, number>();
        for (const mov of consumos) {
          const cantidad = Number(mov.cantidad);
          if (mov.lote_id !== null) {
            await tx.stockLoteSucursal.upsert({
              where: {
                sucursal_id_lote_id: {
                  sucursal_id: sucursalBigInt,
                  lote_id: mov.lote_id,
                },
              },
              update: { cantidad: { increment: cantidad } },
              create: {
                sucursal_id: sucursalBigInt,
                lote_id: mov.lote_id,
                cantidad,
              },
            });
          }
          const key = mov.item_id.toString();
          incrementosPorInsumo.set(key, (incrementosPorInsumo.get(key) ?? 0) + cantidad);
        }

        if (consumos.length > 0) {
          await tx.movimientoInventario.createMany({
            data: consumos.map((mov) => ({
              sucursal_id: sucursalBigInt,
              item_id: mov.item_id,
              lote_id: mov.lote_id,
              empleado_id: BigInt(sesion.empleadoId),
              tipo: "Entrada" as const,
              motivo: "Ajuste" as const,
              cantidad: mov.cantidad,
              costo_unit: mov.costo_unit,
              referencia: `Anulación Pedido #${pedidoBigInt} (Reponer)`.slice(0, 64),
            })),
          });
        }

        for (const [insumoIdStr, total] of incrementosPorInsumo) {
          await tx.inventarioSucursal.updateMany({
            where: { sucursal_id: sucursalBigInt, item_id: BigInt(insumoIdStr) },
            data: { stock: { increment: total } },
          });
        }
      } else {
        // MERMA: Do NOT alter stock levels; record Merma in Kardex
        if (consumos.length > 0) {
          await tx.movimientoInventario.createMany({
            data: consumos.map((mov) => ({
              sucursal_id: sucursalBigInt,
              item_id: mov.item_id,
              lote_id: mov.lote_id,
              empleado_id: BigInt(sesion.empleadoId),
              tipo: "Salida" as const,
              motivo: "Merma" as const,
              cantidad: mov.cantidad,
              costo_unit: mov.costo_unit,
              referencia: `Anulación Pedido #${pedidoBigInt} (Merma)`.slice(0, 64),
            })),
          });
        }
      }

      // e. BI Purge: Remove corresponding sales records
      await tx.historialVentas.deleteMany({
        where: { pedido_id: pedidoBigInt },
      });

      // f. Cash drawer check
      let alertaCajaCerrada = false;
      let mensajeAlerta: string | null = null;
      const metodoPago = (pedido.factura?.metodo_pago || "").toLowerCase();
      const esEfectivo = metodoPago === "cash" || metodoPago === "efectivo";

      if (esEfectivo && pedido.caja_id) {
        const caja = await tx.caja.findUnique({
          where: { id: pedido.caja_id },
        });

        if (caja) {
          if (caja.estado === "abierta") {
            await tx.movimientoCaja.create({
              data: {
                caja_id: caja.id,
                tipo: "EGRESO",
                monto: pedido.total,
                descripcion: `Devolución Anulación Pedido #${pedidoBigInt}`,
                origen: "ANULACION",
              },
            });
          } else {
            alertaCajaCerrada = true;
            mensajeAlerta = `El turno de caja #${caja.id} ya se encuentra cerrado. Se registró una nota de advertencia en dicho turno para conciliación manual de efectivo (Bs ${Number(pedido.total).toFixed(2)}).`;
            const notaCaja = `\n[ALERTA ANULACIÓN POST-CIERRE]: Pedido #${pedidoBigInt} anulado por Administrador. Devolución de efectivo pendiente: Bs ${Number(pedido.total).toFixed(2)}`;
            await tx.caja.update({
              where: { id: caja.id },
              data: {
                observaciones: (caja.observaciones || "") + notaCaja,
              },
            });
          }
        }
      }

      return {
        pedidoId: pedidoBigInt.toString(),
        resolucion_inventario,
        alertaCajaCerrada,
        mensajeAlerta,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Venta anulada correctamente",
      ...resultado,
    });
  } catch (error: any) {
    if (error.message === "Pedido no encontrado") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message === "El pedido ya está anulado") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return errorResponse(error, "Error al anular la venta");
  }
}
