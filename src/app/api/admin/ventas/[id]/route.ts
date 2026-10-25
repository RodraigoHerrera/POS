import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";
import { serializeBigInt } from "@/lib/serialize";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;
    const sucursalId = BigInt(sesion.sucursalId);

    const { id } = await context.params;
    let pedidoId: bigint;
    try {
      pedidoId = BigInt(id);
    } catch {
      return NextResponse.json({ error: "ID de pedido inválido" }, { status: 400 });
    }

    const pedido = await prisma.pedido.findFirst({
      where: {
        id: pedidoId,
        sucursal_id: sucursalId,
      },
      include: {
        factura: true,
        empleado: true,
        caja: {
          include: {
            empleado: true,
          },
        },
        items: {
          include: {
            producto: true,
            extras: true,
          },
        },
      },
    });

    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    // Fetch Kardex movements associated with this order
    const movimientosKardex = await prisma.movimientoInventario.findMany({
      where: {
        sucursal_id: sucursalId,
        referencia: {
          contains: pedido.id.toString(),
        },
      },
      include: {
        item: true,
        lote: true,
      },
      orderBy: { creado_en: "asc" },
    });

    // Cost calculations
    let costoRealTotal = 0;
    let costoTeoricoTotal = 0;
    const itemsCosteo = pedido.items.map((item) => {
      const real = Number(item.costo_real ?? 0);
      const teorico = Number(item.costo_teorico ?? 0);
      const sub = Number(item.subtotal);
      costoRealTotal += real;
      costoTeoricoTotal += teorico;

      const margen = sub - real;
      const margenPct = sub > 0 ? (margen / sub) * 100 : 0;
      const brecha = real - teorico;

      return {
        ...item,
        costo_real_num: real,
        costo_teorico_num: teorico,
        subtotal_num: sub,
        margen_bs: Math.round(margen * 100) / 100,
        margen_pct: Math.round(margenPct * 100) / 100,
        brecha_bs: Math.round(brecha * 100) / 100,
      };
    });

    const totalVenta = Number(pedido.total);
    const margenBruto = totalVenta - costoRealTotal;
    const margenBrutoPct = totalVenta > 0 ? (margenBruto / totalVenta) * 100 : 0;
    const brechaCosto = costoRealTotal - costoTeoricoTotal;

    const auditoria = {
      creado_en: pedido.creado_en,
      actualizado_en: pedido.actualizado_en,
      observaciones: pedido.observaciones,
      mesero: pedido.empleado
        ? {
            id: pedido.empleado.id,
            nombre: pedido.empleado.nombre,
            usuario: pedido.empleado.usuario,
            rol: pedido.empleado.rol,
          }
        : null,
      cajero: pedido.caja?.empleado
        ? {
            id: pedido.caja.empleado.id,
            nombre: pedido.caja.empleado.nombre,
          }
        : null,
      caja_id: pedido.caja_id,
      caja_estado: pedido.caja?.estado,
    };

    return NextResponse.json(
      serializeBigInt({
        success: true,
        data: {
          pedido: {
            ...pedido,
            items: itemsCosteo,
          },
          kardex: movimientosKardex,
          costeo: {
            costoRealTotal: Math.round(costoRealTotal * 100) / 100,
            costoTeoricoTotal: Math.round(costoTeoricoTotal * 100) / 100,
            totalVenta,
            margenBruto: Math.round(margenBruto * 100) / 100,
            margenBrutoPct: Math.round(margenBrutoPct * 100) / 100,
            brechaCosto: Math.round(brechaCosto * 100) / 100,
          },
          auditoria,
        },
      })
    );
  } catch (error: any) {
    return errorResponse(error, "Error al obtener el detalle de la venta");
  }
}
