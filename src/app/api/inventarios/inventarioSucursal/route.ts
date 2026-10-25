import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import { TipoItem } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    const { searchParams } = new URL(request.url);
    const onlyInternal = searchParams.get("onlyInternal") === "true";
    const tipo = searchParams.get("tipo");

    // Validar tipo si se proporciona
    const tipoValido = tipo && Object.values(TipoItem).includes(tipo as TipoItem);

    const items = await prisma.item.findMany({
      where: {
        activo: true,
        ...(onlyInternal ? { tipo: { not: "vendible" } } : {}),
        ...(tipoValido ? { tipo: tipo as TipoItem } : {}),
      },
      select: {
        id: true,
        nombre: true,
        sku: true,
        tipo: true,
        unidad_code: true,
        inventarios: {
          where: { sucursal_id: BigInt(sesion.sucursalId) },
          select: {
            stock: true,
            stock_min: true,
            stock_max: true,
          },
        },
      },
      orderBy: { nombre: "asc" },
    });

    const inventarioLimpio = items.map((item) => {
      const inv = item.inventarios[0];
      return {
        itemId: item.id.toString(),
        nombre: item.nombre,
        sku: item.sku,
        tipo: item.tipo,
        unidad: item.unidad_code,
        stock: inv ? Number(inv.stock) : 0,
        stockMin: inv ? Number(inv.stock_min) : 0,
        stockMax: inv ? Number(inv.stock_max) : 0,
      };
    });

    return NextResponse.json(inventarioLimpio);
  } catch (error) {
    console.error("Error obteniendo inventario:", error);
    return NextResponse.json(
      { error: "Error al cargar el inventario" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Cuerpo de la petición inválido" },
        { status: 400 }
      );
    }

    const { itemId, stockMin, stockMax } = body;

    if (!itemId) {
      return NextResponse.json(
        { error: "El itemId es requerido" },
        { status: 400 }
      );
    }

    const numStockMin = Number(stockMin);
    const numStockMax = Number(stockMax);

    if (
      isNaN(numStockMin) ||
      numStockMin < 0 ||
      isNaN(numStockMax) ||
      numStockMax < 0
    ) {
      return NextResponse.json(
        { error: "Los valores de stock mínimo y máximo deben ser números mayores o iguales a 0" },
        { status: 400 }
      );
    }

    if (numStockMax > 0 && numStockMax < numStockMin) {
      return NextResponse.json(
        { error: "El stock máximo no puede ser menor que el stock mínimo" },
        { status: 400 }
      );
    }

    const registro = await prisma.inventarioSucursal.upsert({
      where: {
        sucursal_id_item_id: {
          sucursal_id: BigInt(sesion.sucursalId),
          item_id: BigInt(itemId),
        },
      },
      update: {
        stock_min: numStockMin,
        stock_max: numStockMax,
      },
      create: {
        sucursal_id: BigInt(sesion.sucursalId),
        item_id: BigInt(itemId),
        stock: 0,
        costo_promedio: 0,
        stock_min: numStockMin,
        stock_max: numStockMax,
      },
    });

    return NextResponse.json({
      success: true,
      item: {
        itemId: itemId.toString(),
        stockMin: Number(registro.stock_min),
        stockMax: Number(registro.stock_max),
        stock: Number(registro.stock),
      },
    });
  } catch (error) {
    console.error("Error actualizando stock de inventario:", error);
    return NextResponse.json(
      { error: "Error al actualizar los umbrales de stock" },
      { status: 500 }
    );
  }
}
