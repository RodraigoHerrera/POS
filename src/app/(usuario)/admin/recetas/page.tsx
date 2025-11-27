"use client";

import React, { useEffect, useState, useCallback } from "react";
import RecetasCard from "@/components/ui/items/recetasCard";

interface Item {
  id: number;
  tipo: string;
  nombre: string;
  sku: string;
  unidad_code: string;
}

export default function UsuariosSucursal() {
  const [item, setItems] = useState<Item[]>([]);

  // ---------- Helpers ----------

  const cargarItems = useCallback(async () => {
    try {
      const res = await fetch("/api/inventarios/items", { credentials: "include" });
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
          RECETAS
        </h1>

        <div>
          {/* AQUI ESTA EL CAMBIO: Agregamos .filter antes del .map */}
          {item
            .filter((i) => i.tipo === "vendible")
            .map((item) => (
              <RecetasCard key={item.id} itemData={item} onSaved={cargarItems} />
            ))}
        </div>

      </div>
    </>
  );
}