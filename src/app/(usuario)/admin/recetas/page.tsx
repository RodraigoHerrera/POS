"use client";

import React, { useMemo, useState } from "react";
import RecetasCard from "@/components/ui/items/recetasCard";
import ListCardSkeleton from "@/components/ui/skeleton/ListCardSkeleton";
import { useFetchData } from "@/hooks/useFetchData";
import {
  ChefHat,
  Search,
  X,
  RotateCw,
  Utensils,
  Layers,
  BookOpen,
  ArrowUpDown,
} from "lucide-react";

interface Item {
  id: number;
  tipo: string;
  nombre: string;
  sku: string;
  unidad_code: string;
  fotoUrl?: string;
  costo_estandar?: number;
  activo?: boolean;
}

type FilterType = "todos" | "vendible" | "prep";
type SortOption = "nombre-asc" | "nombre-desc" | "sku-asc";

/**
 * Normaliza cadenas para búsqueda insensible a acentos y mayúsculas
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function RecetasPage() {
  const { data: items, loading, reload: cargarItems } = useFetchData<Item[]>(
    "/api/inventarios/items",
    []
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("todos");
  const [sortBy, setSortBy] = useState<SortOption>("nombre-asc");

  // Filtrar solo items que admiten receta (vendibles y preparaciones)
  const recipeItems = useMemo(() => {
    return (items || []).filter(
      (item) => item.tipo === "vendible" || item.tipo === "prep"
    );
  }, [items]);

  // Contadores para métricas y tabs
  const totalCount = recipeItems.length;
  const vendiblesCount = useMemo(
    () => recipeItems.filter((i) => i.tipo === "vendible").length,
    [recipeItems]
  );
  const prepCount = useMemo(
    () => recipeItems.filter((i) => i.tipo === "prep").length,
    [recipeItems]
  );

  // Filtrado reactivo y ordenamiento
  const filteredItems = useMemo(() => {
    let list = [...recipeItems];

    // Filtrar por categoría
    if (filterType !== "todos") {
      list = list.filter((i) => i.tipo === filterType);
    }

    // Filtrar por búsqueda (nombre o SKU)
    const query = normalizeText(searchQuery.trim());
    if (query) {
      list = list.filter((item) => {
        const matchName = normalizeText(item.nombre).includes(query);
        const matchSku = normalizeText(item.sku).includes(query);
        return matchName || matchSku;
      });
    }

    // Ordenamiento
    list.sort((a, b) => {
      if (sortBy === "nombre-asc") return a.nombre.localeCompare(b.nombre);
      if (sortBy === "nombre-desc") return b.nombre.localeCompare(a.nombre);
      if (sortBy === "sku-asc") return a.sku.localeCompare(b.sku);
      return 0;
    });

    return list;
  }, [recipeItems, filterType, searchQuery, sortBy]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setFilterType("todos");
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            Gestión de Recetas
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configuración de fórmulas (BOM), costeo de insumos y modificadores de productos del menú y sub-recetas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => cargarItems()}
            disabled={loading}
            title="Actualizar catálogo de recetas"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-700 shadow-2xs transition hover:bg-gray-50 active:scale-95 disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <RotateCw className={`h-4 w-4 ${loading ? "animate-spin text-brand-500" : ""}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Tarjetas KPI de Resumen y Filtro Rápido */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Todas */}
        <button
          type="button"
          onClick={() => setFilterType("todos")}
          className={`group relative flex flex-col text-left rounded-2xl border p-4 transition-all duration-200 ${
            filterType === "todos"
              ? "border-brand-500 bg-brand-500/[0.04] ring-1 ring-brand-500/30 dark:bg-brand-500/10"
              : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-white/3 dark:hover:border-gray-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Fichas Técnicas</span>
            <div className="rounded-lg bg-gray-100 p-2 text-gray-600 dark:bg-white/5 dark:text-gray-300">
              <BookOpen className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? "..." : totalCount}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">fórmulas activas</span>
          </div>
          <span className="mt-2 text-xs font-medium text-brand-500">
            {filterType === "todos" ? "● Mostrando todo" : "Ver todas →"}
          </span>
        </button>

        {/* Vendibles */}
        <button
          type="button"
          onClick={() => setFilterType("vendible")}
          className={`group relative flex flex-col text-left rounded-2xl border p-4 transition-all duration-200 ${
            filterType === "vendible"
              ? "border-emerald-500 bg-emerald-500/[0.05] ring-1 ring-emerald-500/30 dark:bg-emerald-500/10"
              : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-white/3 dark:hover:border-gray-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Productos Vendibles</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Utensils className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? "..." : vendiblesCount}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">productos de carta</span>
          </div>
          <span className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {filterType === "vendible" ? "● Filtro activo" : "Filtrar vendibles →"}
          </span>
        </button>

        {/* Preparaciones */}
        <button
          type="button"
          onClick={() => setFilterType("prep")}
          className={`group relative flex flex-col text-left rounded-2xl border p-4 transition-all duration-200 ${
            filterType === "prep"
              ? "border-amber-500 bg-amber-500/[0.05] ring-1 ring-amber-500/30 dark:bg-amber-500/10"
              : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-white/3 dark:hover:border-gray-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Preparaciones Base</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? "..." : prepCount}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">sub-recetas internas</span>
          </div>
          <span className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
            {filterType === "prep" ? "● Filtro activo" : "Filtrar preparaciones →"}
          </span>
        </button>
      </div>

      {/* Contenedor Principal: Barra de Búsqueda + Filtros + Lista */}
      <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3 sm:p-6">
        {/* Barra de Búsqueda y Segmented Controls */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Input de Búsqueda */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar receta por nombre o SKU"
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-800 dark:bg-gray-900/50 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500 dark:focus:bg-gray-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Limpiar búsqueda"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Segmented Controls & Sort */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Tabs Segmentados */}
            <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900">
              <button
                type="button"
                onClick={() => setFilterType("todos")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  filterType === "todos"
                    ? "bg-white text-gray-900 shadow-2xs dark:bg-gray-800 dark:text-white"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                Todas ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("vendible")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  filterType === "vendible"
                    ? "bg-white text-emerald-700 shadow-2xs dark:bg-gray-800 dark:text-emerald-400"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                Vendibles ({vendiblesCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("prep")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  filterType === "prep"
                    ? "bg-white text-amber-700 shadow-2xs dark:bg-gray-800 dark:text-amber-400"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                Preparaciones ({prepCount})
              </button>
            </div>

            {/* Selector de Orden */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="cursor-pointer appearance-none rounded-xl border border-gray-200 bg-gray-50/50 py-2 pl-8 pr-8 text-xs font-medium text-gray-700 hover:bg-gray-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <option value="nombre-asc">Nombre (A → Z)</option>
                <option value="nombre-desc">Nombre (Z → A)</option>
                <option value="sku-asc">SKU (Código)</option>
              </select>
              <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Barra de Filtros Activos (si hay búsqueda o filtro activo) */}
        {(searchQuery || filterType !== "todos") && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-xs text-gray-600 dark:border-gray-800/60 dark:bg-white/[0.02] dark:text-gray-400">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Mostrando <strong>{filteredItems.length}</strong> de {totalCount} recetas
              </span>
              {searchQuery && (
                <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 font-medium text-gray-700 shadow-2xs dark:bg-gray-800 dark:text-gray-300">
                  Búsqueda: &ldquo;{searchQuery}&rdquo;
                </span>
              )}
              {filterType !== "todos" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 font-medium text-gray-700 shadow-2xs dark:bg-gray-800 dark:text-gray-300">
                  Tipo: {filterType === "vendible" ? "Productos Vendibles" : "Preparaciones Base"}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleClearFilters}
              className="font-semibold text-brand-500 hover:underline cursor-pointer"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {/* Lista de Recetas / Skeletons / Estado Vacío */}
        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <ListCardSkeleton key={i} />)
          ) : filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <RecetasCard key={item.id} itemData={item} onSaved={cargarItems} />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16 px-4 text-center dark:border-gray-800">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500 dark:bg-brand-500/20">
                <ChefHat className="h-7 w-7" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                No se encontraron recetas
              </h3>
              <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                {searchQuery
                  ? `No hay ninguna ficha técnica que coincida con "${searchQuery}". Revisa la ortografía o intenta buscar por código SKU.`
                  : "No hay recetas registradas para esta categoría."}
              </p>
              {(searchQuery || filterType !== "todos") && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 active:scale-95 cursor-pointer"
                >
                  <RotateCw className="h-4 w-4" />
                  Restablecer filtros
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
