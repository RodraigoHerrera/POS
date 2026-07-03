"use client";

import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { Skeleton } from "@/components/ui/skeleton/Skeleton";
import { CheckCircleIcon } from "@/icons";

interface ItemInventario {
  itemId: string;
  nombre: string;
  stock: number;
  stockMin: number;
  unidad: string;
  sku: string | null;
}

type Severidad = "Crítico" | "Bajo";

interface ItemAlerta extends ItemInventario {
  severidad: Severidad;
}

const MAX_FILAS = 5;

type Props = {
  onReponer: (itemId: string) => void;
  onVerTodos?: () => void;
};

export default function StockAlertsCard({ onReponer, onVerTodos }: Props) {
  const [items, setItems] = useState<ItemInventario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const obtenerDatos = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    obtenerDatos();
  }, [obtenerDatos]);

  // stockMin === 0 significa "sin mínimo definido", no se considera alerta
  const alertas: ItemAlerta[] = items
    .filter((item) => item.stockMin > 0 && item.stock <= item.stockMin)
    .map((item) => ({
      ...item,
      severidad: item.stock === 0 ? "Crítico" : ("Bajo" as Severidad),
    }))
    .sort((a, b) => {
      if (a.severidad !== b.severidad) return a.severidad === "Crítico" ? -1 : 1;
      return a.nombre.localeCompare(b.nombre);
    });

  const filasVisibles = alertas.slice(0, MAX_FILAS);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
          Alertas de stock
        </h3>
        {alertas.length > MAX_FILAS && onVerTodos && (
          <button
            type="button"
            onClick={onVerTodos}
            className="text-sm font-medium text-brand-500 hover:text-brand-600"
          >
            Ver todos
          </button>
        )}
      </div>

      {cargando && (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      )}

      {!cargando && error && (
        <div className="mt-4 flex flex-col items-start gap-3">
          <p className="text-sm text-error-600 dark:text-error-500">{error}</p>
          <Button size="sm" variant="outline" onClick={obtenerDatos}>
            Reintentar
          </Button>
        </div>
      )}

      {!cargando && !error && alertas.length === 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-success-50 px-4 py-3 dark:bg-success-500/15">
          <CheckCircleIcon className="h-5 w-5 text-success-600 dark:text-success-500" />
          <p className="text-sm font-medium text-success-600 dark:text-success-500">
            Todo el stock está en niveles saludables.
          </p>
        </div>
      )}

      {!cargando && !error && alertas.length > 0 && (
        <ul role="list" className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
          {filasVisibles.map((item) => (
            <li
              key={item.itemId}
              aria-label={`${item.nombre}, ${item.stock} ${item.unidad}, estado ${item.severidad}`}
              className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <Badge color={item.severidad === "Crítico" ? "error" : "warning"}>
                  {item.severidad}
                </Badge>
                <span className="text-sm font-medium text-gray-800 dark:text-white">
                  {item.nombre}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {item.stock} / {item.stockMin} {item.unidad}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Reponer ${item.nombre}`}
                  onClick={() => onReponer(item.itemId)}
                >
                  Reponer
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
