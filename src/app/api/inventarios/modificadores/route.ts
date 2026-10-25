import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/inventarios/modificadores?itemVendibleId=<id>
// Lista los extras (modificadorProducto) configurados para un item vendible,
// con el nombre/unidad del insumo que consume cada uno. Lo usan tanto el
// admin (editor de extras) como el cajero (selector de extras en /ventas).
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const itemVendibleId = searchParams.get("itemVendibleId");
    if (!itemVendibleId) {
      return NextResponse.json({ message: "Falta itemVendibleId" }, { status: 400 });
    }

    const sesion = await requireEmpleado();
    if (esRespuestaError(sesion)) return sesion;

    const modificadores = await prisma.modificadorProducto.findMany({
      where: { item_vendible_id: BigInt(itemVendibleId) },
      include: { item_insumo: { select: { id: true, nombre: true, unidad_code: true } } },
    });

    const resultado = modificadores.map((m) => ({
      id: m.id,
      itemInsumoId: m.item_insumo_id,
      nombre: m.item_insumo.nombre,
      unidad_code: m.item_insumo.unidad_code,
      delta_cantidad: m.delta_cantidad,
      precio: m.precio,
    }));

    return NextResponse.json(serializeBigInt(resultado));
  } catch (error) {
    return errorResponse(error, "Error al obtener los extras del producto");
  }
}
