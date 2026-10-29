"use client";

import React, { useEffect, useState } from "react";
import { Search, Calendar, RotateCcw, Filter, X } from "lucide-react";
import DatePicker from "@/components/form/date-picker";
import { rangoDesdeSeleccion } from "@/lib/rangoFechas";

export interface VentasFilterValues {
  desde: string;
  hasta: string;
  estado: string;
  q: string;
}

interface VentasFiltersProps {
  filters: VentasFilterValues;
  onChange: (updates: Partial<VentasFilterValues & { page: number }>) => void;
  onReset: () => void;
  isLoading?: boolean;
}

export default function VentasFilters({
  filters,
  onChange,
  onReset,
  isLoading,
}: VentasFiltersProps) {
  const [localSearch, setLocalSearch] = useState(filters.q);

  useEffect(() => {
    setLocalSearch(filters.q);
  }, [filters.q]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.q) {
        onChange({ q: localSearch, page: 1 });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [localSearch, filters.q, onChange]);

  const setDatePreset = (preset: "hoy" | "7dias" | "mes" | "todos") => {
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const todayStr = formatDate(today);

    if (preset === "hoy") {
      onChange({ desde: todayStr, hasta: todayStr, page: 1 });
    } else if (preset === "7dias") {
      const past = new Date(today);
      past.setDate(today.getDate() - 6);
      onChange({ desde: formatDate(past), hasta: todayStr, page: 1 });
    } else if (preset === "mes") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      onChange({ desde: formatDate(firstDay), hasta: todayStr, page: 1 });
    } else if (preset === "todos") {
      onChange({ desde: "", hasta: "", page: 1 });
    }
  };

  const hasActiveFilters =
    Boolean(filters.desde) ||
    Boolean(filters.hasta) ||
    Boolean(filters.q) ||
    (filters.estado !== "TODOS" && Boolean(filters.estado));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900/40 md:p-5">
      <div className="flex flex-col gap-4">
        {/* Top row: Search and Preset Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Buscar por ID comanda, factura, cliente, NIT o razón social..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-10 pr-10 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700/80 dark:bg-gray-800/50 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-brand-500 dark:focus:bg-gray-800 transition-colors"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch("");
                  onChange({ q: "", page: 1 });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
            <span className="text-gray-500 dark:text-gray-400 mr-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Periodo:
            </span>
            <button
              type="button"
              onClick={() => setDatePreset("hoy")}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-brand-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/80 transition"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setDatePreset("7dias")}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-brand-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/80 transition"
            >
              Últimos 7 días
            </button>
            <button
              type="button"
              onClick={() => setDatePreset("mes")}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-brand-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/80 transition"
            >
              Este Mes
            </button>
            <button
              type="button"
              onClick={() => setDatePreset("todos")}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-brand-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/80 transition"
            >
              Histórico
            </button>
          </div>
        </div>

        {/* Bottom row: Date Range & Estado Selector & Reset */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-2 border-t border-gray-100 dark:border-gray-800/60">
          <div className="sm:col-span-2">
            <label htmlFor="ventas-periodo" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Periodo
            </label>
            <DatePicker
              id="ventas-periodo"
              mode="range"
              placeholder="Todas las fechas"
              value={[filters.desde, filters.hasta]}
              onChange={(fechas) => {
                const r = rangoDesdeSeleccion(fechas);
                if (r) onChange({ ...r, page: 1 });
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Estado de Comanda
            </label>
            <div className="relative">
              <select
                value={filters.estado}
                onChange={(e) => onChange({ estado: e.target.value, page: 1 })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="TODOS">Todos los estados</option>
                <option value="PAGADO">PAGADO (Cobrado)</option>
                <option value="ANULADO">ANULADO (Cancelado)</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="COMANDADO">COMANDADO</option>
                <option value="PREPARADO">PREPARADO</option>
                <option value="ENTREGADO">ENTREGADO</option>
              </select>
            </div>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={onReset}
              disabled={!hasActiveFilters || isLoading}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/80 transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
