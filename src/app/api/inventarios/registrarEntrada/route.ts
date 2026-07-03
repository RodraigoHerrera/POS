import { NextResponse } from "next/server";
import { prisma } from "@/lib/db"; // Ajusta el import según tu estructura
import { serializeBigInt } from "@/lib/serialize";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;
    const sucursalIdStr = sesion.sucursalId;

    const body = await req.json();

    const {
      item: item_id,
      lote: codigo_lote,
      cantidad,
      costo_unitario: costo_unit,
      fechaVenc: fecha_vencimiento,
      referencia,
      motivo,
      proveedor: proveedor_id,
    } = body;

    // Validación mínima
    if (!item_id || !cantidad || !costo_unit) {
      return NextResponse.json(
        { message: "Faltan campos requeridos: item_id, cantidad, costo_unit" },
        { status: 400 }
      );
    }

    // Convertimos a números para cálculos matemáticos
    const qtyEntrada = Number(cantidad);
    const costoEntrada = Number(costo_unit);

    // =====================================================================
    // INICIO DE LA LÓGICA DE ACTUALIZACIÓN
    // =====================================================================

    // 0️⃣ Registrar el proveedor preferido del item (usado luego por el MRP)
    if (proveedor_id) {
      await prisma.item.update({
        where: { id: BigInt(item_id) },
        data: { proveedor_id: BigInt(proveedor_id) },
      });
    }

    // 1️⃣ Crear el lote
    const lote = await prisma.lote.create({
      data: {
        item_id: BigInt(item_id), // Aseguramos BigInt si tu schema lo usa
        codigo_lote,
        fecha_caducidad: fecha_vencimiento ? new Date(fecha_vencimiento) : null,
        costo_unit: costoEntrada,
      },
    });

    // 2️⃣ Crear o Actualizar inventarioSucursal (CORREGIDO)
    let inventario = await prisma.inventarioSucursal.findFirst({
      where: { 
        item_id: BigInt(item_id), 
        sucursal_id: BigInt(sucursalIdStr) 
      },
    });

    if (!inventario) {
      // A) Si NO existe: CREAR
      inventario = await prisma.inventarioSucursal.create({
        data: {
          item_id: BigInt(item_id),
          sucursal_id: BigInt(sucursalIdStr),
          stock: qtyEntrada,
          costo_promedio: costoEntrada,
        },
      });
    } else {
      // B) Si YA existe: ACTUALIZAR (Promedio Ponderado)
      const stockActual = Number(inventario.stock);
      const costoActual = Number(inventario.costo_promedio);

      const nuevoStockTotal = stockActual + qtyEntrada;
      
      // Fórmula: ((StockActual * CostoActual) + (Entrada * CostoEntrada)) / NuevoStockTotal
      let nuevoCostoPromedio = costoEntrada; // Default por si el stock actual es 0
      
      if (nuevoStockTotal > 0) {
        const valorTotal = (stockActual * costoActual) + (qtyEntrada * costoEntrada);
        nuevoCostoPromedio = valorTotal / nuevoStockTotal;
      }

      inventario = await prisma.inventarioSucursal.update({
        where: { id: inventario.id },
        data: {
          stock: { increment: qtyEntrada }, // Sumamos la cantidad
          costo_promedio: nuevoCostoPromedio, // Actualizamos el costo
        },
      });
    }

    // 3️⃣ Crear stockLoteSucursal
    const stockLote = await prisma.stockLoteSucursal.create({
      data: {
        sucursal_id: BigInt(sucursalIdStr),
        lote_id: lote.id,
        cantidad: qtyEntrada,
      },
    });

    // 4️⃣ Registrar movimientoInventario
    const movimiento = await prisma.movimientoInventario.create({
      data: {
        sucursal_id: BigInt(sucursalIdStr),
        item_id: BigInt(item_id),
        lote_id: lote.id,
        tipo: "Entrada",
        motivo: motivo || "Compra",
        cantidad: qtyEntrada,
        costo_unit: costoEntrada,
        referencia: referencia ?? `Lote-${lote.id}`,
      },
    });

    return NextResponse.json(
      {
        message: "Inventario actualizado correctamente",
        lote: serializeBigInt(lote),
        inventario: serializeBigInt(inventario),
      },
      { status: 201 }
    );

  } catch (error) {
    return errorResponse(error, "Error al registrar la entrada de inventario");
  }
}