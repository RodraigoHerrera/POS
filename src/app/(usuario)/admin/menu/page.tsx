"use client";

import React, { useEffect, useState, useCallback } from "react";
import ProductosCard from "@/components/ui/productos/ProductosCard";

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
  const [item, setItems] = useState<Item[]>([]);

  // ---------- Helpers ----------

  const cargarItems = useCallback(async () => {
    try {
      const res = await fetch("/api/inventarios/productos", { credentials: "include" });
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error("Error al obtener item:", err);
    }
  }, []);

  // ---------- Effects ----------
  useEffect(() => {
    cargarItems();
  }, [cargarItems]);

  // ---------- Handlers ----------

  return (
    <>
      <div className="space-y-10 rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/3 sm:space-y-6">
        <h1 className="mt-2 text-center font-bold text-gray-800 text-title-sm dark:text-white/90">
          CATALOGO DE PRODUCTOS
        </h1>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {/* AQUI ESTA EL CAMBIO: Agregamos .filter antes del .map */}
          {item.map((item) => (
              <ProductosCard key={item.id} itemData={item} onSaved={cargarItems} />
            ))}
        </div>

      </div>
    </>
  );
}
