import { NextResponse } from "next/server";
import { serializeBigInt } from "@/lib/serialize";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import { runWithRetry } from "@/lib/transactionRetry";
import { actualizarInventarioEntrada } from "@/lib/inventario";
import { resolverCostoUnitario } from "@/lib/costoEntrada";
import { ValidationError } from "@/lib/validation";
import { esCodigoLoteDuplicado, resolverCodigoLote } from "@/lib/codigoLote";
import { obtenerZonaMrp } from "@/lib/mrp/zonaHoraria";

// Motivos del enum MotivoMovimiento que tienen sentido para una entrada
// manual de inventario. Se valida ANTES de escribir: antes un motivo
// inválido reventaba contra el enum de la BD a mitad de las escrituras.
const MOTIVOS_ENTRADA_VALIDOS = ["Compra", "Ajuste", "Traslado", "Produccion"];

export async function POST(req: Request) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;
    const sucursalIdStr = sesion.sucursalId;

    const body = await req.json();

    const {
      item: item_id,
      lote: codigo_lote_recibido,
      cantidad,
      costo_unitario,
      costo_unit: costo_unit_alt,
      costo_total,
      fechaVenc: fecha_vencimiento,
      referencia,
      motivo,
      proveedor: proveedor_id,
    } = body;

    const costo_unit = costo_unitario !== undefined ? costo_unitario : costo_unit_alt;
    // Sin codigo se genera uno: codigo_lote es unico por item en todas las sucursales
    const codigo_lote = resolverCodigoLote(codigo_lote_recibido, new Date(), undefined, obtenerZonaMrp());

    // Validación: costo 0 es legítimo (donaciones/promos), negativo no.
    // `== null` cubre undefined y null sin rechazar el 0.
    if (!item_id || cantidad == null || (costo_unit == null && costo_total == null)) {
      return NextResponse.json(
        { message: "Faltan campos requeridos: item_id, cantidad, costo_unit (o costo_total)" },
        { status: 400 }
      );
    }

    const qtyEntrada = Number(cantidad);

    if (!Number.isFinite(qtyEntrada) || qtyEntrada <= 0) {
      return NextResponse.json(
        { message: "La cantidad debe ser un número mayor a 0" },
        { status: 400 }
      );
    }

    // El servidor deriva el unitario del total (total / cantidad) cuando llega costo_total.
    let costoEntrada: number;
    try {
      costoEntrada = resolverCostoUnitario({ costo_unit, costo_total, cantidad: qtyEntrada }) as number;
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      throw error;
    }

    const motivoEntrada = motivo || "Compra";
    if (!MOTIVOS_ENTRADA_VALIDOS.includes(motivoEntrada)) {
      return NextResponse.json(
        { message: `motivo debe ser uno de: ${MOTIVOS_ENTRADA_VALIDOS.join(", ")}` },
        { status: 400 }
      );
    }

    // SEC-05 & INV-3: Ejecución transaccional con reintento automático ante deadlocks.
    // Secuencia de mutación estricta INV-3:
    // 1. item.update (si proveedor_id)
    // 2. lote.create
    // 3. stockLoteSucursal.create (precede a inventarioSucursal para evitar deadlock con registrarPedido)
    // 4. actualizarInventarioEntrada (pesimista FOR UPDATE y recálculo ponderado atómico)
    // 5. movimientoInventario.create (kardex)
    const resultado = await runWithRetry(
      async (tx) => {
        // 1️⃣ Registrar el proveedor preferido del item (usado luego por el MRP)
        if (proveedor_id) {
          await tx.item.update({
            where: { id: BigInt(item_id) },
            data: { proveedor_id: BigInt(proveedor_id) },
          });
        }

        // 2️⃣ Crear el lote
        const lote = await tx.lote.create({
          data: {
            item_id: BigInt(item_id),
            codigo_lote,
            fecha_caducidad: fecha_vencimiento ? new Date(fecha_vencimiento) : null,
            costo_unit: costoEntrada,
          },
        });

        // 3️⃣ Crear stockLoteSucursal (INV-3: DEBE preceder a inventarioSucursal)
        await tx.stockLoteSucursal.create({
          data: {
            sucursal_id: BigInt(sucursalIdStr),
            lote_id: lote.id,
            cantidad: qtyEntrada,
          },
        });

        // 4️⃣ Actualizar inventarioSucursal (upsert base + SELECT FOR UPDATE + recálculo ponderado)
        const inventario = await actualizarInventarioEntrada(
          tx,
          sucursalIdStr,
          item_id,
          qtyEntrada,
          costoEntrada
        );

        // 5️⃣ Registrar movimientoInventario
        await tx.movimientoInventario.create({
          data: {
            sucursal_id: BigInt(sucursalIdStr),
            item_id: BigInt(item_id),
            lote_id: lote.id,
            empleado_id: BigInt(sesion.empleadoId),
            tipo: "Entrada",
            motivo: motivoEntrada as "Compra" | "Ajuste" | "Traslado" | "Produccion",
            cantidad: qtyEntrada,
            costo_unit: costoEntrada,
            referencia: referencia ?? `Lote-${lote.id}`,
          },
        });

        return { lote, inventario };
      },
      { timeoutMs: 15000 }
    );

    return NextResponse.json(
      {
        message: "Inventario actualizado correctamente",
        lote: serializeBigInt(resultado.lote),
        inventario: serializeBigInt(resultado.inventario),
      },
      { status: 201 }
    );
  } catch (error) {
    if (esCodigoLoteDuplicado(error)) {
      return NextResponse.json(
        { message: "Ya existe un lote con ese código para este item" },
        { status: 409 }
      );
    }
    return errorResponse(error, "Error al registrar la entrada de inventario");
  }
}
