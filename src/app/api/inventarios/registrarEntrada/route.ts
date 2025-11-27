import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

async function getSucursalIdFromToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    // En tu login firmamos sucursalId como string, no number
    return (payload as any)?.sucursalId as string | undefined;
  } catch (error) {
    return null;
  }
}


export async function POST(req: Request) {
  try {
    
    const body = await req.json();

    const cookieStore = await cookies();
    const tokenSucursal = cookieStore.get("tokenSucursal")?.value;
    
    if (!tokenSucursal) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }

    const sucursalIdStr = await getSucursalIdFromToken(tokenSucursal);

    if (!sucursalIdStr) {
    return NextResponse.json({ message: "Token inválido" }, { status: 403 });
  }
    

    const {
      item: item_id,
      lote: codigo_lote,
      cantidad,
      costo_unitario: costo_unit,
      fechaVenc: fecha_vencimiento,
      referencia,
        motivo,
    } = body;

    // Validación mínima
    if (!item_id || !cantidad || !costo_unit) {
      return NextResponse.json(
        { message: "Faltan campos requeridos: item_id, cantidad, costo_unit" },
        { status: 400 }
      );
    }

    // 1️⃣ Crear el lote
    const lote = await prisma.lote.create({
      data: {
        item_id,
        codigo_lote,
        fecha_caducidad: fecha_vencimiento ? new Date(fecha_vencimiento) : null,
        costo_unit,
      },
    });

    // 2️⃣ Crear o actualizar inventarioSucursal (registro por item en esa sucursal)
    let inventario = await prisma.inventarioSucursal.findFirst({
      where: { item_id, sucursal_id: BigInt(sucursalIdStr) },
    });

    if (!inventario) {
      inventario = await prisma.inventarioSucursal.create({
        data: {
          item_id,
          sucursal_id: BigInt(sucursalIdStr),
          stock: cantidad,
          costo_promedio: costo_unit,
        },
      });
    }

    // 3️⃣ Crear stockLoteSucursal (cuánto de ese lote llegó a la sucursal)
    const stockLote = await prisma.stockLoteSucursal.create({
      data: {
        sucursal_id: BigInt(sucursalIdStr),
        lote_id: lote.id,
        cantidad: cantidad,
      },
    });

    // 4️⃣ Registrar movimientoInventario
    const movimiento = await prisma.movimientoInventario.create({
      data: {
        sucursal_id: BigInt(sucursalIdStr),
        item_id,
        lote_id: lote.id,
        tipo: "Entrada",
        motivo,
        cantidad,
        costo_unit,
        referencia: referencia ?? `Lote-${lote.id}`,
      },
    });

    return NextResponse.json(
      {
        message: "Inventario actualizado correctamente",
        lote: { ...lote, id: lote.id.toString() },
        stockLote: { ...stockLote, id: stockLote.id.toString() },
        inventario: { ...inventario, id: inventario.id.toString() },
        movimiento: { ...movimiento, id: movimiento.id.toString() },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al insertar inventario:", error);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}
