"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { Skeleton } from "@/components/ui/skeleton/Skeleton";
import { toast } from "sonner";
import {
  getStockStatus,
  validateStockThresholds,
  StockStatusKey,
} from "@/lib/inventory/stockStatus";

export interface ItemControlStock {
  itemId: string;
  nombre: string;
  sku: string | null;
  tipo: string;
  unidad: string;
  stock: number;
  stockMin: number;
  stockMax: number;
}

interface RowInputState {
  stockMin: number | string;
  stockMax: number | string;
}

interface ControlStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReponer: (itemId: string) => void;
  onSaved?: () => void;
}

const TIPO_LABELS: Record<string, string> = {
  insumo: "Insumo",
  prep: "Preparación",
  oficina: "Oficina",
  vendible: "Vendible",
};

export default function ControlStockModal({
  isOpen,
  onClose,
  onReponer,
  onSaved,
}: ControlStockModalProps) {
  const [items, setItems] = useState<ItemControlStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  // Filtros
  const [activeTab, setActiveTab] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [onlyAlerts, setOnlyAlerts] = useState<boolean>(false);

  // Valores locales editados por ítem { [itemId]: { stockMin, stockMax } }
  const [rowInputs, setRowInputs] = useState<Record<string, RowInputState>>({});

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/inventarios/inventarioSucursal?onlyInternal=true");
      if (!res.ok) {
        throw new Error("No se pudo cargar el inventario de la sucursal");
      }
      const data: ItemControlStock[] = await res.json();
      setItems(data);

      // Inicializar inputs
      const initialInputs: Record<string, RowInputState> = {};
      data.forEach((item) => {
        initialInputs[item.itemId] = {
          stockMin: item.stockMin,
          stockMax: item.stockMax,
        };
      });
      setRowInputs(initialInputs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cargar inventario";
      console.error(msg, err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen, fetchItems]);

  // Manejo de cambios en inputs por fila
  const handleInputChange = (
    itemId: string,
    field: "stockMin" | "stockMax",
    val: string
  ) => {
    setRowInputs((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: val,
      },
    }));
  };

  // Guardar fila individual
  const handleGuardarFila = async (item: ItemControlStock) => {
    const inputs = rowInputs[item.itemId] || {
      stockMin: item.stockMin,
      stockMax: item.stockMax,
    };

    const numMin = Number(inputs.stockMin);
    const numMax = Number(inputs.stockMax);

    const validation = validateStockThresholds(numMin, numMax);
    if (!validation.valid) {
      toast.error(validation.error || "Valores de stock inválidos");
      return;
    }

    try {
      setSavingItemId(item.itemId);
      const res = await fetch("/api/inventarios/inventarioSucursal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.itemId,
          stockMin: numMin,
          stockMax: numMax,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al actualizar los umbrales");
      }

      // Actualizar estado local optimista
      setItems((prev) =>
        prev.map((it) =>
          it.itemId === item.itemId
            ? { ...it, stockMin: numMin, stockMax: numMax }
            : it
        )
      );

      toast.success(`Stock de "${item.nombre}" actualizado correctamente`);
      onSaved?.();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al guardar umbrales";
      toast.error(msg);
    } finally {
      setSavingItemId(null);
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    let criticos = 0;
    let bajos = 0;
    let saludables = 0;
    let sobreStock = 0;
    let sinControl = 0;

    items.forEach((item) => {
      const status = getStockStatus(item.stock, item.stockMin, item.stockMax);
      switch (status.key) {
        case "critico":
          criticos++;
          break;
        case "bajo":
          bajos++;
          break;
        case "normal":
          saludables++;
          break;
        case "exceso":
          sobreStock++;
          break;
        case "sin_control":
          sinControl++;
          break;
      }
    });

    return {
      total: items.length,
      criticos,
      bajos,
      saludables,
      sobreStock,
      sinControl,
    };
  }, [items]);

  // Conteo de pestañas
  const tabCounts = useMemo(() => {
    return {
      todos: items.length,
      insumo: items.filter((i) => i.tipo === "insumo").length,
      prep: items.filter((i) => i.tipo === "prep").length,
      oficina: items.filter((i) => i.tipo === "oficina").length,
    };
  }, [items]);

  // Ítems filtrados
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Filtro pestaña
      if (activeTab !== "todos" && item.tipo !== activeTab) {
        return false;
      }

      // Filtro búsqueda
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase();
        const matchesNombre = item.nombre.toLowerCase().includes(query);
        const matchesSku = item.sku ? item.sku.toLowerCase().includes(query) : false;
        if (!matchesNombre && !matchesSku) return false;
      }

      // Filtro solo alertas
      if (onlyAlerts) {
        const status = getStockStatus(item.stock, item.stockMin, item.stockMax);
        if (status.key !== "critico" && status.key !== "bajo") {
          return false;
        }
      }

      return true;
    });
  }, [items, activeTab, searchTerm, onlyAlerts]);

  const tabs = [
    { id: "todos", label: "Todos", count: tabCounts.todos },
    { id: "insumo", label: "Insumos", count: tabCounts.insumo },
    { id: "prep", label: "Preparaciones", count: tabCounts.prep },
    { id: "oficina", label: "Oficina", count: tabCounts.oficina },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[1200px] m-4">
      <div className="no-scrollbar relative w-full max-w-[1200px] max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-5 dark:bg-gray-900 lg:p-9">
        {/* Cabecera */}
        <div className="px-1 pr-14 mb-4">
          <h4 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            Control de Stock de Sucursal
          </h4>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Calibre los umbrales mínimos y máximos por producto para automatizar alertas y sugerencias de reposición.
          </p>
        </div>

        {/* Resumen KPI */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-800/40">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Ítems</span>
            <p className="mt-1 text-xl font-bold text-gray-800 dark:text-white">{kpis.total}</p>
          </div>
          <div className="rounded-xl border border-error-200 bg-error-50/50 p-3 dark:border-error-900/30 dark:bg-error-900/10">
            <span className="text-xs font-medium text-error-700 dark:text-error-400">Críticos (Agotados)</span>
            <p className="mt-1 text-xl font-bold text-error-600 dark:text-error-400">{kpis.criticos}</p>
          </div>
          <div className="rounded-xl border border-warning-200 bg-warning-50/50 p-3 dark:border-warning-900/30 dark:bg-warning-900/10">
            <span className="text-xs font-medium text-warning-700 dark:text-warning-400">Bajo Stock</span>
            <p className="mt-1 text-xl font-bold text-warning-600 dark:text-warning-400">{kpis.bajos}</p>
          </div>
          <div className="rounded-xl border border-success-200 bg-success-50/50 p-3 dark:border-success-900/30 dark:bg-success-900/10">
            <span className="text-xs font-medium text-success-700 dark:text-success-400">Saludables</span>
            <p className="mt-1 text-xl font-bold text-success-600 dark:text-success-400">{kpis.saludables}</p>
          </div>
          <div className="rounded-xl border border-blue-light-200 bg-blue-light-50/50 p-3 dark:border-blue-light-900/30 dark:bg-blue-light-900/10">
            <span className="text-xs font-medium text-blue-light-700 dark:text-blue-light-400">Sobre-stock</span>
            <p className="mt-1 text-xl font-bold text-blue-light-600 dark:text-blue-light-400">{kpis.sobreStock}</p>
          </div>
        </div>

        {/* Pestañas de Categoría */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 gap-2 mb-5 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2.5 px-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.id
                  ? "border-brand-500 text-brand-600 dark:text-brand-400 font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                  activeTab === tab.id
                    ? "bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filtro de búsqueda y toggle solo alertas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Buscar por nombre o SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:text-white/90"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={onlyAlerts}
              onChange={(e) => setOnlyAlerts(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-700"
            />
            <span className="font-medium">Solo alertas (Crítico / Bajo stock)</span>
          </label>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-error-50 p-4 dark:bg-error-900/20">
            <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
            <Button size="sm" variant="outline" onClick={fetchItems}>
              Reintentar
            </Button>
          </div>
        )}

        {/* Tabla */}
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Stock Actual</th>
                  <th className="px-4 py-3 w-28">Stock Mín</th>
                  <th className="px-4 py-3 w-28">Stock Máx</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                {loading && (
                  <>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-8 w-24" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-8 w-24" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-6 w-20" /></td>
                        <td className="px-4 py-3 text-right"><Skeleton className="h-8 w-28 ml-auto" /></td>
                      </tr>
                    ))}
                  </>
                )}

                {!loading && filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No se encontraron ítems que coincidan con los filtros aplicados.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredItems.map((item) => {
                    const inputs = rowInputs[item.itemId] || {
                      stockMin: item.stockMin,
                      stockMax: item.stockMax,
                    };
                    const status = getStockStatus(
                      item.stock,
                      item.stockMin,
                      item.stockMax
                    );
                    const isSaving = savingItemId === item.itemId;

                    // Verificar si hubo cambios
                    const isChanged =
                      Number(inputs.stockMin) !== item.stockMin ||
                      Number(inputs.stockMax) !== item.stockMax;

                    return (
                      <tr
                        key={item.itemId}
                        className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">
                          {item.sku || "—"}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">
                          {item.nombre}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                          <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 dark:bg-gray-800 font-medium">
                            {TIPO_LABELS[item.tipo] || item.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800 dark:text-white whitespace-nowrap">
                          {item.stock}{" "}
                          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                            {item.unidad}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={inputs.stockMin}
                            onChange={(e) =>
                              handleInputChange(item.itemId, "stockMin", e.target.value)
                            }
                            className="h-8 w-24 rounded-md border border-gray-300 bg-transparent px-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:text-white"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={inputs.stockMax}
                            onChange={(e) =>
                              handleInputChange(item.itemId, "stockMax", e.target.value)
                            }
                            className="h-8 w-24 rounded-md border border-gray-300 bg-transparent px-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:text-white"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge color={status.color} size="sm">
                            {status.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant={isChanged ? "primary" : "outline"}
                              disabled={isSaving}
                              onClick={() => handleGuardarFila(item)}
                            >
                              {isSaving ? "Guardando..." : "Guardar"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onReponer(item.itemId)}
                            >
                              Reponer
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
