"use client";

import React from "react";
import RecetasCard from "@/components/ui/items/recetasCard";
import ListCardSkeleton from "@/components/ui/skeleton/ListCardSkeleton";
import { useFetchData } from "@/hooks/useFetchData";

interface Item {
  id: number;
  tipo: string;
  nombre: string;
  sku: string;
  unidad_code: string;
}

export default function recetas() {
  const { data: item, loading, reload: cargarItems } = useFetchData<Item[]>("/api/inventarios/items", []);

  return (
    <>
      <div className="space-y-10 rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/3 sm:space-y-6">
        <h1 className="mt-2 text-center font-bold text-gray-800 text-title-sm dark:text-white/90">
          RECETAS
        </h1>

        <div className="space-y-6">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <ListCardSkeleton key={i} />)
            : item
                .filter((i) => i.tipo === "vendible")
                .map((item) => (
                  <RecetasCard key={item.id} itemData={item} onSaved={cargarItems} />
                ))}
        </div>

      </div>
    </>
  );
}
