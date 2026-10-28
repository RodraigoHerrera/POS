import React from "react";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { obtenerSesionEmpleado } from "@/lib/auth";
import { prepararRecetasProduccion } from "@/lib/produccion";
import ProductionClient, { ProduccionReciente } from "./ProductionClient";

export const metadata = {
  title: "Producción - Admin",
};

export default async function ProduccionPage() {
  const sesion = await obtenerSesionEmpleado();
  if (!sesion) redirect("/usuarios");
  const sucursalId = BigInt(sesion.sucursalId);

  // Solo los items de preparación se producen por lote: los vendibles ya
  // descuentan su receta al venderse.
  const [recetasData, sucursal, recientesData] = await Promise.all([
    prisma.receta.findMany({
      where: { item_vendible: { tipo: "prep" } },
      include: {
        item_vendible: { select: { nombre: true, unidad_code: true, vida_util_dias: true } },
        items: { include: { item_insumo: { select: { nombre: true, unidad_code: true } } } },
      },
      orderBy: { item_vendible: { nombre: "asc" } },
    }),
    prisma.sucursales.findUnique({
      where: { id: sucursalId },
      select: { nombre: true },
    }),
    prisma.produccion.findMany({
      where: { sucursal_id: sucursalId },
      include: {
        prep_item: { select: { nombre: true, unidad_code: true } },
        lote_generado: { select: { codigo_lote: true, costo_unit: true, fecha_caducidad: true } },
      },
      orderBy: { creado_en: "desc" },
      take: 8,
    }),
  ]);

  const insumoIds = [
    ...new Set(recetasData.flatMap((r) => r.items.map((ri) => ri.item_insumo_id))),
  ];

  // Stock por lotes: es lo que la producción consume realmente (FEFO).
  const [lotes, inventarios] = await Promise.all([
    prisma.stockLoteSucursal.findMany({
      where: { sucursal_id: sucursalId, cantidad: { gt: 0 }, lote: { item_id: { in: insumoIds } } },
      select: { cantidad: true, lote: { select: { item_id: true } } },
    }),
    prisma.inventarioSucursal.findMany({
      where: { sucursal_id: sucursalId, item_id: { in: insumoIds } },
      select: { item_id: true, costo_promedio: true },
    }),
  ]);

  const stockPorInsumo = new Map<string, Prisma.Decimal>();
  for (const l of lotes) {
    const clave = l.lote.item_id.toString();
    stockPorInsumo.set(clave, (stockPorInsumo.get(clave) ?? new Prisma.Decimal(0)).add(l.cantidad));
  }
  const costoPorInsumo = new Map(inventarios.map((i) => [i.item_id.toString(), i.costo_promedio]));

  const recetas = prepararRecetasProduccion(recetasData, stockPorInsumo, costoPorInsumo);

  const recientes: ProduccionReciente[] = recientesData.map((p) => ({
    id: p.id.toString(),
    fecha: p.creado_en.toISOString(),
    nombre: p.prep_item.nombre,
    unidad: p.prep_item.unidad_code,
    cantidad: Number(p.cantidad),
    codigoLote: p.lote_generado.codigo_lote,
    costoUnit: Number(p.lote_generado.costo_unit),
    caducidad: p.lote_generado.fecha_caducidad?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
          Registro de Producción
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Consume insumos por FEFO y genera el lote de la preparación
        </p>
      </div>

      <ProductionClient
        recetas={recetas}
        recientes={recientes}
        sucursalNombre={sucursal?.nombre ?? ""}
      />
    </div>
  );
}
