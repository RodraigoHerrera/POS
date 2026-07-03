import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

const TIPOS_MERMA_VALIDOS = ["vencimiento", "dano", "robo", "error"];

// POST /api/inventarios/mermas
// { itemId, cantidad, tipoMerma, motivo?, loteReferencia? }
// Descuenta stock por FEFO (mismos lotes/orden que una venta), registra el
// movimiento de kardex (tipo Salida, motivo Merma) y reporta el costo
// perdido. Es la salida que el kardex necesita para que la brecha
// costo_real-vs-teórico sea explicable (no solo "se perdió algo": se sabe
// cuánto, de qué insumo, y por qué).
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { itemId, cantidad, tipoMerma, motivo, loteReferencia } = body;

    if (!itemId || !cantidad || Number(cantidad) <= 0) {
      return NextResponse.json(
        { message: "Faltan campos requeridos: itemId, cantidad (> 0)" },
        { status: 400 }
      );
    }
    if (!tipoMerma || !TIPOS_MERMA_VALIDOS.includes(tipoMerma)) {
      return NextResponse.json(
        { message: `tipoMerma debe ser uno de: ${TIPOS_MERMA_VALIDOS.join(", ")}` },
        { status: 400 }
      );
    }

    // Cualquier empleado autenticado puede reportar una merma (es quien está
    // en piso quien la nota), no solo el administrador.
    const sesion = await requireEmpleado();
    if (esRespuestaError(sesion)) return sesion;
    const sucursalId = sesion.sucursalId;

    const sucursalBigInt = BigInt(sucursalId);
    const itemBigInt = BigInt(itemId);
    const cantidadMerma = Number(cantidad);

    // Referencia corta para el kardex: tipo + detalle, recortado a 64 chars (columna VarChar(64)).
    const etiquetaTipo: Record<string, string> = {
      vencimiento: "Vencimiento",
      dano: "Daño",
      robo: "Robo",
      error: "Error de registro",
    };
    const partesReferencia = [etiquetaTipo[tipoMerma]];
    if (loteReferencia) partesReferencia.push(`lote ${loteReferencia}`);
    if (motivo) partesReferencia.push(motivo);
    const referencia = partesReferencia.join(" — ").slice(0, 64);

    const resultado = await prisma.$transaction(async (tx) => {
      // Lotes disponibles, FEFO (mismo orden que una venta — el más próximo a
      // vencer es, casi siempre, también el más probable de haberse perdido).
      const lotesDisponibles = await tx.stockLoteSucursal.findMany({
        where: {
          sucursal_id: sucursalBigInt,
          lote: { item_id: itemBigInt },
          cantidad: { gt: 0 },
        },
        include: { lote: true },
        orderBy: { lote: { fecha_caducidad: "asc" } },
      });

      const stockDisponible = lotesDisponibles.reduce((acc, l) => acc + Number(l.cantidad), 0);
      if (stockDisponible < cantidadMerma) {
        throw new Error(
          `Stock insuficiente: hay ${stockDisponible} disponible y se intenta registrar una merma de ${cantidadMerma}`
        );
      }

      let restante = cantidadMerma;
      let costoTotalPerdido = 0;
      const movimientos: {
        lote_id: bigint;
        cantidad: number;
        costo_unit: number;
      }[] = [];

      for (const stockLote of lotesDisponibles) {
        if (restante <= 0) break;
        const disponibleEnLote = Number(stockLote.cantidad);
        const aDescontar = Math.min(disponibleEnLote, restante);
        if (aDescontar <= 0) continue;

        await tx.stockLoteSucursal.update({
          where: { id: stockLote.id },
          data: { cantidad: { decrement: aDescontar } },
        });

        const costoUnit = Number(stockLote.lote.costo_unit);
        movimientos.push({ lote_id: stockLote.lote_id, cantidad: aDescontar, costo_unit: costoUnit });
        costoTotalPerdido += aDescontar * costoUnit;
        restante -= aDescontar;
      }

      await tx.movimientoInventario.createMany({
        data: movimientos.map((m) => ({
          sucursal_id: sucursalBigInt,
          item_id: itemBigInt,
          lote_id: m.lote_id,
          tipo: "Salida" as const,
          motivo: "Merma" as const,
          cantidad: m.cantidad,
          costo_unit: m.costo_unit,
          referencia,
        })),
      });

      await tx.inventarioSucursal.updateMany({
        where: { sucursal_id: sucursalBigInt, item_id: itemBigInt },
        data: { stock: { decrement: cantidadMerma } },
      });

      return { costoTotalPerdido, lotesAfectados: movimientos.length };
    });

    return NextResponse.json(
      serializeBigInt({
        success: true,
        message: "Merma registrada correctamente",
        cantidad: cantidadMerma,
        costoTotalPerdido: resultado.costoTotalPerdido,
        lotesAfectados: resultado.lotesAfectados,
      })
    );
  } catch (error: any) {
    if (typeof error?.message === "string" && error.message.startsWith("Stock insuficiente")) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    return errorResponse(error, "Error al registrar la merma");
  }
}
