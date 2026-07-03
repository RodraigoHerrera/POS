import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";
import { serializeBigInt } from "@/lib/serialize";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import { construirSerieDiaria, pronosticarDemandaDiaria } from "@/lib/mrp/forecast";
import { explotarMPS, type TipoItemReceta } from "@/lib/mrp/explosion";
import { calcularNecesidadNeta } from "@/lib/mrp/necesidad";
import { agruparPorProveedor } from "@/lib/mrp/ordenes";
import {
  cargarRecetasRecursivo,
  obtenerVentasDiariasPorProducto,
  obtenerEntradasProgramadas,
} from "@/lib/mrp/data";

// Días de historia de historialVentas usados para pronosticar.
const LOOKBACK_DIAS = 60;

export async function POST(req: Request) {
  try {
    // 1. Autenticación y rol
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;
    const sucursalId = sesion.sucursalId;
    const empleadoId: string | null = sesion.empleadoId;

    const body = await req.json().catch(() => ({}));
    const horizonteDiasInput = Number(body?.horizonteDias);
    const horizonteDias =
      horizonteDiasInput > 0 ? Math.min(horizonteDiasInput, 60) : 7;
    const alpha = Number(body?.alpha) > 0 && Number(body.alpha) <= 1 ? Number(body.alpha) : 0.3;

    const sucursalBigInt = BigInt(sucursalId);
    const hoy = new Date();
    const desde = new Date(hoy);
    desde.setDate(desde.getDate() - LOOKBACK_DIAS);
    // El día de "hoy" está incompleto (sigue acumulando ventas): entrenar el
    // pronóstico con ese punto parcial sesga el nivel hacia abajo justo antes
    // de proyectar hacia adelante. La serie de historia solo debe llegar
    // hasta el último día ya cerrado.
    const finHistoria = new Date(hoy);
    finHistoria.setDate(finHistoria.getDate() - 1);

    // 2. PRONÓSTICO: serie diaria por producto a partir de historialVentas
    const ventasPorProducto = await obtenerVentasDiariasPorProducto(sucursalBigInt, desde);
    const productoIds = [...ventasPorProducto.keys()].map((id) => BigInt(id));

    if (productoIds.length === 0) {
      return NextResponse.json({
        success: true,
        mensaje: "No hay historial de ventas en esta sucursal para pronosticar",
        forecast: [],
        necesidades: [],
        ordenesGeneradas: [],
        sinProveedor: [],
        advertencias: [],
      });
    }

    const productos = await prisma.producto.findMany({
      where: { id: { in: productoIds } },
      select: { id: true, nombre: true, item_inventario_id: true },
    });

    interface LineaForecast {
      productoId: bigint;
      nombre: string;
      itemVendibleId: bigint | null;
      cantidadHorizonte: number;
      mpsQty: number;
      mapePct: number | null;
      metodo: string;
    }

    const forecastLineas: LineaForecast[] = productos.map((p) => {
      const serieMap = ventasPorProducto.get(p.id.toString()) ?? new Map();
      const serieDiaria = construirSerieDiaria(serieMap, desde, finHistoria);
      const resultado = pronosticarDemandaDiaria(serieDiaria, horizonteDias, { alpha });
      return {
        productoId: p.id,
        nombre: p.nombre,
        itemVendibleId: p.item_inventario_id,
        cantidadHorizonte: resultado.cantidadHorizonte,
        mpsQty: Math.round(resultado.cantidadHorizonte),
        mapePct: resultado.mapePct,
        metodo: resultado.metodo,
      };
    });

    const advertenciasGlobales: { itemId: string; mensaje: string }[] = [];

    const productoIdsEncontrados = new Set(productos.map((p) => p.id.toString()));
    for (const id of productoIds) {
      if (!productoIdsEncontrados.has(id.toString())) {
        advertenciasGlobales.push({
          itemId: id.toString(),
          mensaje: `historialVentas referencia el producto_id ${id.toString()}, que ya no existe en el catálogo; se ignora para el pronóstico`,
        });
      }
    }

    const lineasConMps = forecastLineas.filter((l) => l.mpsQty > 0);
    for (const l of lineasConMps.filter((l) => !l.itemVendibleId)) {
      advertenciasGlobales.push({
        itemId: l.productoId.toString(),
        mensaje: `"${l.nombre}" no está vinculado a un item de inventario; no se puede explotar su receta`,
      });
    }

    const lineasExplotables = lineasConMps.filter(
      (l): l is LineaForecast & { itemVendibleId: bigint } => l.itemVendibleId !== null
    );

    // 3. MPS + EXPLOSIÓN MULTINIVEL
    // Se explota producto por producto (no en batch) para poder ponderar el
    // MAPE de cada insumo por el aporte real de cada producto a su demanda.
    const itemVendibleIds = lineasExplotables.map((l) => l.itemVendibleId);
    const itemsVendiblesInfo = itemVendibleIds.length
      ? await prisma.item.findMany({
          where: { id: { in: itemVendibleIds } },
          select: { id: true, tipo: true },
        })
      : [];
    const tipoPorItemVendible = new Map(
      itemsVendiblesInfo.map((i) => [i.id.toString(), i.tipo as TipoItemReceta])
    );

    const recetaMap = await cargarRecetasRecursivo(itemVendibleIds);

    const brutaTotalPorItem = new Map<string, number>();
    const nivelPorItem = new Map<string, number>();
    const mapeWeightedSum = new Map<string, number>();
    const mapeWeightSum = new Map<string, number>();

    for (const l of lineasExplotables) {
      const tipo = tipoPorItemVendible.get(l.itemVendibleId.toString()) ?? "vendible";
      const { requerimientos, advertencias } = explotarMPS(
        [{ itemId: l.itemVendibleId.toString(), tipo, cantidad: l.mpsQty }],
        recetaMap
      );
      advertenciasGlobales.push(...advertencias);

      for (const r of requerimientos) {
        brutaTotalPorItem.set(r.itemId, (brutaTotalPorItem.get(r.itemId) ?? 0) + r.cantidadBruta);
        nivelPorItem.set(r.itemId, Math.min(nivelPorItem.get(r.itemId) ?? r.nivel, r.nivel));
        if (l.mapePct !== null) {
          mapeWeightedSum.set(
            r.itemId,
            (mapeWeightedSum.get(r.itemId) ?? 0) + r.cantidadBruta * l.mapePct
          );
          mapeWeightSum.set(r.itemId, (mapeWeightSum.get(r.itemId) ?? 0) + r.cantidadBruta);
        }
      }
    }

    const itemIdsNecesidad = [...brutaTotalPorItem.keys()];
    const itemIdsBigInt = itemIdsNecesidad.map((id) => BigInt(id));

    const [inventarios, itemsMeta, entradasProgramadas] = await Promise.all([
      itemIdsBigInt.length
        ? prisma.inventarioSucursal.findMany({
            where: { sucursal_id: sucursalBigInt, item_id: { in: itemIdsBigInt } },
            select: { item_id: true, stock: true, stock_min: true, costo_promedio: true },
          })
        : Promise.resolve([]),
      itemIdsBigInt.length
        ? prisma.item.findMany({
            where: { id: { in: itemIdsBigInt } },
            select: {
              id: true,
              nombre: true,
              lead_time_dias: true,
              vida_util_dias: true,
              proveedor_id: true,
              proveedor: { select: { nombre: true } },
            },
          })
        : Promise.resolve([]),
      obtenerEntradasProgramadas(sucursalBigInt, itemIdsBigInt),
    ]);

    const inventarioPorItem = new Map(inventarios.map((i) => [i.item_id.toString(), i]));
    const metaPorItem = new Map(itemsMeta.map((i) => [i.id.toString(), i]));

    // 4. NETEO
    interface NecesidadCompleta {
      itemId: string;
      nombre: string;
      necesidadBruta: number;
      stockActual: number;
      entradasProgramadas: number;
      stockSeguridad: number;
      necesidadNeta: number;
      fechaSugeridaEmision: Date;
      nivelExplosion: number;
      proveedorId: string | null;
      proveedorNombre: string | null;
      costoUnitEstimado: number;
      observaciones: string | null;
      mapeBlendPct: number | null;
    }

    const necesidades: NecesidadCompleta[] = itemIdsNecesidad.map((itemId) => {
      const meta = metaPorItem.get(itemId);
      const inv = inventarioPorItem.get(itemId);
      const necesidadBruta = brutaTotalPorItem.get(itemId) ?? 0;
      const demandaDiariaInsumo = necesidadBruta / horizonteDias;
      const pesoMape = mapeWeightSum.get(itemId) ?? 0;
      const mapeBlend = pesoMape > 0 ? mapeWeightedSum.get(itemId)! / pesoMape : null;

      const resultado = calcularNecesidadNeta(
        {
          itemId,
          necesidadBruta,
          stockActual: inv ? Number(inv.stock) : 0,
          entradasProgramadas: entradasProgramadas.get(itemId) ?? 0,
          stockMin: inv ? Number(inv.stock_min) : 0,
          leadTimeDias: meta?.lead_time_dias ?? 0,
          vidaUtilDias: meta?.vida_util_dias ?? null,
          mapeBlendPct: mapeBlend,
          demandaDiariaInsumo,
        },
        horizonteDias,
        hoy
      );

      const observacionesPartes: string[] = [];
      if (!meta) observacionesPartes.push("Item sin metadatos de compra");
      if (!inv) observacionesPartes.push("Sin registro de inventario en esta sucursal (stock asumido en 0)");
      if (resultado.topeCaducidadAplicado) {
        observacionesPartes.push("Cantidad limitada por vida útil/caducidad del insumo");
      }
      if (meta && !meta.proveedor_id) observacionesPartes.push("Sin proveedor preferido asignado");

      return {
        itemId,
        nombre: meta?.nombre ?? itemId,
        necesidadBruta: resultado.necesidadBruta,
        stockActual: resultado.stockActual,
        entradasProgramadas: resultado.entradasProgramadas,
        stockSeguridad: resultado.stockSeguridad,
        necesidadNeta: resultado.necesidadNeta,
        fechaSugeridaEmision: resultado.fechaSugeridaEmision,
        nivelExplosion: nivelPorItem.get(itemId) ?? 0,
        proveedorId: meta?.proveedor_id ? meta.proveedor_id.toString() : null,
        proveedorNombre: meta?.proveedor?.nombre ?? null,
        costoUnitEstimado: inv ? Number(inv.costo_promedio) : 0,
        observaciones: observacionesPartes.length ? observacionesPartes.join("; ") : null,
        mapeBlendPct: mapeBlend,
      };
    });

    // 5. AGRUPACIÓN EN ÓRDENES DE COMPRA BORRADOR
    const { ordenes, sinProveedor } = agruparPorProveedor(
      necesidades.map((n) => ({
        itemId: n.itemId,
        necesidadNeta: n.necesidadNeta,
        proveedorId: n.proveedorId,
        costoUnitEstimado: n.costoUnitEstimado,
        fechaSugeridaEmision: n.fechaSugeridaEmision,
      }))
    );

    // 6. PERSISTENCIA (una sola transacción: corrida + detalle + OC Borrador)
    const resultadoTx = await prisma.$transaction(async (tx) => {
      const corrida = await tx.mrpCorrida.create({
        data: {
          sucursal_id: sucursalBigInt,
          horizonte_dias: horizonteDias,
          metodo: "suavizacion_exponencial",
          parametros: { alpha },
          empleado_id: empleadoId ? BigInt(empleadoId) : null,
        },
      });

      const forecastAPersistir = forecastLineas.filter((l) => l.cantidadHorizonte > 0);
      if (forecastAPersistir.length > 0) {
        await tx.mrpForecastDetalle.createMany({
          data: forecastAPersistir.map((l) => ({
            corrida_id: corrida.id,
            producto_id: l.productoId,
            periodo_inicio: hoy,
            periodo_fin: new Date(hoy.getTime() + horizonteDias * 24 * 60 * 60 * 1000),
            cantidad_pronosticada: l.cantidadHorizonte,
            mape_pct: l.mapePct,
            mps_qty: l.mpsQty,
          })),
        });
      }

      if (necesidades.length > 0) {
        await tx.mrpNecesidadInsumo.createMany({
          data: necesidades.map((n) => ({
            corrida_id: corrida.id,
            item_id: BigInt(n.itemId),
            necesidad_bruta: n.necesidadBruta,
            stock_actual: n.stockActual,
            entradas_programadas: n.entradasProgramadas,
            stock_seguridad: n.stockSeguridad,
            necesidad_neta: n.necesidadNeta,
            fecha_sugerida_emision: n.fechaSugeridaEmision,
            nivel_explosion: n.nivelExplosion,
            observaciones: n.observaciones,
          })),
        });
      }

      const ordenesCreadas = [];
      for (const orden of ordenes) {
        const oc = await tx.ordenCompra.create({
          data: {
            sucursal_id: sucursalBigInt,
            proveedor_id: BigInt(orden.proveedorId),
            estado: "Borrador",
            total: orden.total,
            mrp_corrida_id: corrida.id,
            items: {
              create: orden.items.map((it) => ({
                item_id: BigInt(it.itemId),
                cantidad: it.cantidad,
                costo_unit: it.costoUnit,
              })),
            },
          },
          include: {
            proveedor: { select: { nombre: true } },
            items: { include: { item: { select: { nombre: true, unidad_code: true } } } },
          },
        });
        ordenesCreadas.push(oc);
      }

      return { corrida, ordenesCreadas };
    });

    return NextResponse.json(
      serializeBigInt({
        success: true,
        corridaId: resultadoTx.corrida.id,
        horizonteDias,
        forecast: forecastLineas,
        necesidades,
        ordenesGeneradas: resultadoTx.ordenesCreadas,
        sinProveedor,
        advertencias: advertenciasGlobales,
      })
    );
  } catch (error: any) {
    return errorResponse(error, "Error al ejecutar el MRP");
  }
}
