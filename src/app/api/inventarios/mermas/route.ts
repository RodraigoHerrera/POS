import { NextResponse } from "next/server";
import { serializeBigInt } from "@/lib/serialize";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError, TokenCookieReader } from "@/lib/auth";
import { ValidationError, validationErrorResponse } from "@/lib/validation";
import { runWithRetry } from "@/lib/transactionRetry";
import {
  validarDatosMerma,
  construirReferenciaKardexMerma,
  calcularAsignacionesMermaFEFO,
  ejecutarRegistroMermaTx,
} from "@/lib/mermas";

function getCookieReaderFromRequest(req: Request): TokenCookieReader | undefined {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return undefined;
  const parsed = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
  return {
    get: (name: string) => (parsed[name] ? { value: parsed[name] } : undefined),
  };
}

// POST /api/inventarios/mermas
// { itemId, cantidad, tipoMerma, motivo?, loteReferencia? }
// Descuenta stock por FEFO (mismos lotes/orden que una venta), registra el
// movimiento de kardex (tipo Salida, motivo Merma) y reporta el costo
// perdido. Es la salida que el kardex necesita para que la brecha
// costo_real-vs-teórico sea explicable (no solo "se perdió algo": se sabe
// cuánto, de qué insumo, y por qué).
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { itemId, cantidad, tipoMerma, motivo, loteReferencia } = validarDatosMerma(body);

    // Cualquier empleado autenticado puede reportar una merma (es quien está
    // en piso quien la nota), no solo el administrador.
    const cookieReader = getCookieReaderFromRequest(req);
    const sesion = await requireEmpleado(undefined, cookieReader);
    if (esRespuestaError(sesion)) return sesion;
    const sucursalId = sesion.sucursalId;

    const sucursalBigInt = BigInt(sucursalId);
    const itemBigInt = itemId;
    const cantidadMerma = cantidad;

    // Referencia corta para el kardex: tipo + detalle, recortado a 64 chars (columna VarChar(64)).
    const referencia = construirReferenciaKardexMerma(tipoMerma, loteReferencia, motivo);

    const resultado = await runWithRetry(
      async (tx) => {
        // Lotes disponibles, FEFO (mismo orden que una venta — el más próximo a
        // vencer es, casi siempre, también el más probable de haberse perdido).
        const lotesDisponibles = await tx.stockLoteSucursal.findMany({
          where: {
            sucursal_id: sucursalBigInt,
            lote: { item_id: itemBigInt },
            cantidad: { gt: 0 },
          },
          include: { lote: true },
          orderBy: [
            { lote: { fecha_caducidad: "asc" } },
            { id: "asc" },
          ],
        });

        const { allocations, costoTotalPerdido } = calcularAsignacionesMermaFEFO(
          lotesDisponibles,
          cantidadMerma
        );

        return await ejecutarRegistroMermaTx(tx, {
          sucursalId: sucursalBigInt,
          itemId: itemBigInt,
          cantidadMerma,
          referencia,
          allocations,
          costoTotalPerdido,
        });
      },
      { timeoutMs: 15000, maxRetries: 3 }
    );

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
    if (error instanceof ValidationError) {
      return validationErrorResponse(error);
    }
    if (typeof error?.message === "string" && error.message.startsWith("Stock insuficiente")) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    return errorResponse(error, "Error al registrar la merma");
  }
}
