import React from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerSesionEmpleado } from "@/lib/auth";
import ProductionClient from "./ProductionClient";

export const metadata = {
  title: "Producción - Admin",
};

export default async function ProduccionPage() {
  const sesion = await obtenerSesionEmpleado();
  if (!sesion) redirect("/usuarios");

  // Solo los items de preparación se producen por lote: los vendibles ya
  // descuentan su receta al venderse.
  const recetasData = await prisma.receta.findMany({
    where: { item_vendible: { tipo: "prep" } },
    include: {
      item_vendible: true,
    },
  });

  const sucursal = await prisma.sucursales.findUnique({
    where: { id: BigInt(sesion.sucursalId) },
    select: { nombre: true },
  });

  const recipes = recetasData.map((r) => ({
    id: r.id.toString(),
    name: r.item_vendible.nombre,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Registro de Producción
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Ejecute un lote de producción consumiendo insumos bajo método FEFO y generando el lote de producto terminado.
        </p>
      </div>

      <ProductionClient recipes={recipes} sucursalNombre={sucursal?.nombre ?? ""} />
    </div>
  );
}
