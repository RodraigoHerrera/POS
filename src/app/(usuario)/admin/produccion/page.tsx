import React from "react";
import { prisma } from "@/lib/db";
import ProductionClient from "./ProductionClient";

export const metadata = {
  title: "Producción - Admin",
};

export default async function ProduccionPage() {
  const recetasData = await prisma.receta.findMany({
    include: {
      item_vendible: true,
    },
  });

  const sucursalesData = await prisma.sucursales.findMany({
    select: {
      id: true,
      nombre: true,
    },
  });

  const recipes = recetasData.map((r) => ({
    id: r.id.toString(),
    name: r.item_vendible.nombre,
  }));

  const sucursales = sucursalesData.map((s) => ({
    id: s.id.toString(),
    name: s.nombre,
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

      <ProductionClient recipes={recipes} sucursales={sucursales} />
    </div>
  );
}
