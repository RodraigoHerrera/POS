"use client";

import React, { useEffect, useState } from "react";
import TableRowSkeleton from "@/components/ui/skeleton/TableRowSkeleton";
import Badge from "@/components/ui/badge/Badge";

interface ItemInventario {
  itemId: string;
  nombre: string;
  stock: number;
  stockMin: number;
  unidad: string;
  sku: string | null;
}

export default function StockReportPage() {
  const [items, setItems] = useState<ItemInventario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const obtenerDatos = async () => {
    try {
      setCargando(true);
      setError("");
      const respuesta = await fetch("/api/inventarios/inventarioSucursal");

      if (!respuesta.ok) {
        throw new Error("Error al conectar con el servidor");
      }

      const datos: ItemInventario[] = await respuesta.json();
      setItems(datos);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar el inventario.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    obtenerDatos();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
          Estado del Stock
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Monitor en tiempo real de las cantidades disponibles en la sucursal.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Item
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Stock Actual
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Stock Mínimo
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
              {cargando ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRowSkeleton key={i} columns={4} />
                ))
              ) : error ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No hay items en el inventario.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isCritico = item.stock === 0 && item.stockMin > 0;
                  const isAgotado = item.stock === 0 && item.stockMin === 0;
                  const isBajo = item.stockMin > 0 && item.stock > 0 && item.stock <= item.stockMin;
                  
                  // Determinamos etiqueta y color
                  let estadoLabel = "Ok";
                  let estadoColor: "success" | "warning" | "error" | "info" = "success";
                  
                  if (isCritico) {
                    estadoLabel = "Crítico";
                    estadoColor = "error";
                  } else if (isAgotado) {
                    estadoLabel = "Agotado";
                    estadoColor = "warning";
                  } else if (isBajo) {
                    estadoLabel = "Bajo";
                    estadoColor = "warning";
                  }

                  return (
                    <tr
                      key={item.itemId}
                      className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-white">
                        {item.nombre}
                        {item.sku && (
                          <div className="text-xs text-gray-400 font-normal">
                            SKU: {item.sku}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-800 dark:text-gray-200">
                        {item.stock} <span className="text-xs font-normal text-gray-500">{item.unidad}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                        {item.stockMin > 0 ? (
                          <>{item.stockMin} <span className="text-xs">{item.unidad}</span></>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge color={estadoColor}>{estadoLabel}</Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
