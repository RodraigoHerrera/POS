"use client";

import React from "react";
import ProductosCard from "@/components/ui/productos/ProductosCard";
import ProductCardSkeleton from "@/components/ui/skeleton/ProductCardSkeleton";
import { useFetchData } from "@/hooks/useFetchData";

interface Item {
  id: number;
  nombre: string;
  precio: string;
  estado: string;
  categoria: string;
  descripcion: string;
  fotoUrl?: string;
}

export default function menu() {
  const { data: item, loading, reload: cargarItems } = useFetchData<Item[]>("/api/inventarios/productos", []);

  return (
    <>
      <div className="space-y-10 rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/3 sm:space-y-6">
        <h1 className="mt-2 text-center font-bold text-gray-800 text-title-sm dark:text-white/90">
          CATALOGO DE PRODUCTOS
        </h1>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : item.map((item) => (
                <ProductosCard key={item.id} itemData={item} onSaved={cargarItems} />
              ))}
        </div>

      </div>
    </>
  );
}
