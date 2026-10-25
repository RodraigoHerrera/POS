import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/caja/pedidosAbiertos
// Pedidos de la sucursal que aún no fueron cobrados ni anulados (comandas
// vivas), con un resumen de sus items. Alimenta la vista /cajero/pedidos
// para cobrarlos o anularlos — antes de esa vista, un pedido comandado cuyo
// cajero volvía atrás quedaba invisible hasta el reporte del día siguiente.
export async function GET() {
  try {
    const sesion = await requireEmpleado();
    if (esRespuestaError(sesion)) return sesion;

    const pedidos = await prisma.pedido.findMany({
      where: {
        sucursal_id: BigInt(sesion.sucursalId),
        estado: { notIn: ["PAGADO", "ANULADO"] },
      },
      orderBy: { creado_en: "asc" }, // el más viejo primero: es el que urge resolver
      include: {
        empleado: { select: { nombre: true } },
        items: {
          select: {
            cantidad: true,
            producto: { select: { nombre: true } },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      pedidos: pedidos.map((p) => ({
        id: p.id.toString(),
        mesa: p.mesa,
        cliente: p.cliente_nombre,
        estado: p.estado,
        total: Number(p.total),
        creadoEn: p.creado_en.toISOString(),
        empleadoNombre: p.empleado.nombre,
        items: p.items.map((i) => ({
          cantidad: i.cantidad,
          nombre: i.producto.nombre,
        })),
      })),
    });
  } catch (error) {
    return errorResponse(error, "Error al listar los pedidos abiertos");
  }
}
