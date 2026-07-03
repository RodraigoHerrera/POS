import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

// POST /api/caja/anularPedido  { pedidoId, motivo? }
// Anula un pedido NO pagado y repone el inventario que su comanda descontó.
// La reversa se reconstruye desde el kardex: los movimientos Salida/Venta con
// referencia "Pedido #<id>" dicen exactamente qué lotes se consumieron, cuánto
// y a qué costo, así que la devolución vuelve a esos mismos lotes (no rompe el
// FEFO ni inventa costos) y deja su propio rastro Entrada/Ajuste en el kardex.
// Un pedido PAGADO no se puede anular por aquí: eso es una devolución con
// implicaciones de factura y caja, flujo aparte.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { pedidoId, motivo } = body;

    if (!pedidoId) {
      return NextResponse.json({ error: "Falta pedidoId" }, { status: 400 });
    }

    // Cualquier empleado de la sucursal puede anular una comanda no cobrada
    // (es quien está en caja el que detecta el error); queda registrado quién.
    const sesion = await requireEmpleado();
    if (esRespuestaError(sesion)) return sesion;

    const sucursalBigInt = BigInt(sesion.sucursalId);
    const pedidoBigInt = BigInt(pedidoId);

    const resultado = await prisma.$transaction(async (tx) => {
      // Cambio de estado con guard atómico: solo transiciona si el pedido es
      // de esta sucursal y aún no está PAGADO ni ANULADO. Si otra petición
      // concurrente lo pagó o lo anuló primero, count=0 y no se repone nada
      // (evita la doble reposición de stock).
      const notaAnulacion = `ANULADO por empleado #${sesion.empleadoId}${motivo ? `: ${motivo}` : ""}`;
      const transicion = await tx.pedido.updateMany({
        where: {
          id: pedidoBigInt,
          sucursal_id: sucursalBigInt,
          estado: { notIn: ["PAGADO", "ANULADO"] },
        },
        data: {
          estado: "ANULADO",
          observaciones: notaAnulacion,
        },
      });

      if (transicion.count === 0) {
        const pedido = await tx.pedido.findUnique({
          where: { id: pedidoBigInt },
          select: { sucursal_id: true, estado: true },
        });
        if (!pedido || pedido.sucursal_id !== sucursalBigInt) {
          throw new Error("Pedido no encontrado");
        }
        if (pedido.estado === "PAGADO") {
          throw new Error("El pedido ya fue pagado: no se puede anular, requiere devolución");
        }
        throw new Error("El pedido ya está anulado");
      }

      // Consumos originales de la comanda, tal como quedaron en el kardex
      const consumos = await tx.movimientoInventario.findMany({
        where: {
          sucursal_id: sucursalBigInt,
          tipo: "Salida",
          motivo: "Venta",
          referencia: `Pedido #${pedidoBigInt}`,
        },
      });

      // Reponer cada lote consumido (el registro stockLoteSucursal siempre
      // existe porque la venta lo decrementó; upsert cubre el caso límite de
      // un lote purgado a mano).
      const incrementosPorInsumo = new Map<string, number>();
      for (const mov of consumos) {
        const cantidad = Number(mov.cantidad);
        if (mov.lote_id !== null) {
          await tx.stockLoteSucursal.upsert({
            where: {
              sucursal_id_lote_id: { sucursal_id: sucursalBigInt, lote_id: mov.lote_id },
            },
            update: { cantidad: { increment: cantidad } },
            create: { sucursal_id: sucursalBigInt, lote_id: mov.lote_id, cantidad },
          });
        }
        const key = mov.item_id.toString();
        incrementosPorInsumo.set(key, (incrementosPorInsumo.get(key) ?? 0) + cantidad);
      }

      // Rastro de la reversa en el kardex, espejo de los consumos
      if (consumos.length > 0) {
        await tx.movimientoInventario.createMany({
          data: consumos.map((mov) => ({
            sucursal_id: sucursalBigInt,
            item_id: mov.item_id,
            lote_id: mov.lote_id,
            tipo: "Entrada" as const,
            motivo: "Ajuste" as const,
            cantidad: mov.cantidad,
            costo_unit: mov.costo_unit,
            referencia: `Anulación Pedido #${pedidoBigInt}`.slice(0, 64),
          })),
        });
      }

      // Stock agregado por sucursal (1 update por insumo repuesto)
      for (const [insumoIdStr, total] of incrementosPorInsumo) {
        await tx.inventarioSucursal.updateMany({
          where: { sucursal_id: sucursalBigInt, item_id: BigInt(insumoIdStr) },
          data: { stock: { increment: total } },
        });
      }

      return { lotesRepuestos: consumos.length, insumosRepuestos: incrementosPorInsumo.size };
    });

    return NextResponse.json({
      success: true,
      message: "Pedido anulado y stock repuesto",
      ...resultado,
    });
  } catch (error: any) {
    if (error.message === "Pedido no encontrado") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (
      error.message === "El pedido ya está anulado" ||
      error.message?.startsWith("El pedido ya fue pagado")
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return errorResponse(error, "Error al anular el pedido");
  }
}
