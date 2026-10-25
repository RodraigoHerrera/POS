"use client";

import React, { useEffect, useState } from "react";
import { Skeleton } from "../ui/skeleton/Skeleton";

interface ProductoVendido {
  productoId: string;
  nombre: string;
  cantidad: number;
  ventaTotal: number;
}

export default function TopProductosCard() {
  const [productos, setProductos] = useState<ProductoVendido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await fetch("/api/ventas/topProductos");
        const data = await res.json();
        if (data.success) {
          setProductos(data.data);
        } else {
          setError("No se pudo cargar el top de productos.");
        }
      } catch {
        setError("No se pudo cargar el top de productos.");
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const maxCantidad = Math.max(1, ...productos.map((p) => p.cantidad));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/3">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
        Top productos (mes actual)
      </h3>

      {loading && (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      )}

      {!loading && error && <p className="mt-4 text-sm text-error-500">{error}</p>}

      {!loading && !error && productos.length === 0 && (
        <p className="mt-4 text-sm text-gray-400">Todavía no hay ventas este mes.</p>
      )}

      {!loading && !error && productos.length > 0 && (
        <ul role="list" className="mt-4 space-y-3">
          {productos.map((p, idx) => (
            <li key={p.productoId} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-gray-800 dark:text-white">
                    {p.nombre}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    {p.cantidad} u. · Bs {p.ventaTotal.toFixed(2)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-1.5 rounded-full bg-brand-500"
                    style={{ width: `${(p.cantidad / maxCantidad) * 100}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
