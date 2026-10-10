import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

// GET /api/caja/pedido?id=123
export async function GET(req: NextRequest) {
  try {
    const sesion = await requireEmpleado();
    if (esRespuestaError(sesion)) return sesion;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Falta el parámetro id" }, { status: 400 });
    }

    const pedido = await prisma.pedido.findUnique({
      where: { id: BigInt(id), sucursal_id: BigInt(sesion.sucursalId) },
      include: {
        items: {
          include: {
            producto: {
              select: {
                id: true,
                nombre: true,
                precio: true,
                imagenUrl: true,
              },
            },
            extras: true,
          },
        },
      },
    });

    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    if (pedido.estado === "PAGADO" || pedido.estado === "ANULADO") {
      return NextResponse.json(
        { error: `El pedido está ${pedido.estado} y no puede ser editado.` },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      pedido: {
        id: pedido.id.toString(),
        mesa: pedido.mesa,
        cliente: pedido.cliente_nombre,
        estado: pedido.estado,
        observaciones: pedido.observaciones,
        items: pedido.items.map((item: any) => ({
          id: item.id.toString(),
          producto_id: item.producto_id.toString(),
          cantidad: item.cantidad,
          precio_unit: Number(item.precio_unit),
          subtotal: Number(item.subtotal),
          notas: item.notas,
          producto: {
            id: item.producto.id.toString(),
            nombre: item.producto.nombre,
            precio: Number(item.producto.precio),
            imagen: item.producto.imagenUrl,
          },
          extras: item.extras.map((extra: any) => ({
            id: extra.id.toString(),
            nombre: extra.nombre,
            precio: Number(extra.precio),
            item_inv_id: extra.item_inv_id?.toString() || null,
          })),
        })),
      },
    });
  } catch (error) {
    return errorResponse(error, "Error al obtener el pedido");
  }
}
