"use client";

import React, { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import ProductosCard, { type ProductoMenu } from "@/components/ui/productos/ProductosCard";
import { Skeleton } from "@/components/ui/skeleton/Skeleton";
import Button from "@/components/ui/button/Button";
import { useFetchData } from "@/hooks/useFetchData";
import {
  categoriasDeProductos,
  filtrarProductos,
  resumenProductos,
  type FiltroEstadoProducto,
} from "@/lib/menuAdmin";

const CATEGORIAS_LIST_ID = "menu-categorias";

const FILTROS_ESTADO: { valor: FiltroEstadoProducto; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "activos", etiqueta: "Activos" },
  { valor: "inactivos", etiqueta: "Inactivos" },
];

// Placeholder con las mismas dimensiones que la fila de ProductosCard
function ProductoSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-4">
          <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-6 w-11 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function ResumenItem({ etiqueta, valor, loading }: { etiqueta: string; valor: number; loading: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">{etiqueta}</p>
      {loading ? (
        <Skeleton className="mt-1 h-7 w-10" />
      ) : (
        <p className="text-title-sm font-bold text-gray-800 dark:text-white/90">{valor}</p>
      )}
    </div>
  );
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-theme-sm font-medium transition-colors ${
        activo
          ? "border-brand-500 bg-brand-500 text-white"
          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

export default function MenuPage() {
  const {
    data: productos,
    loading,
    error,
    reload: cargarProductos,
  } = useFetchData<ProductoMenu[]>("/api/inventarios/productos?all=true", []);

  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [estado, setEstado] = useState<FiltroEstadoProducto>("todos");

  // Skeleton solo en la primera carga: al recargar tras editar se conserva la lista (y el scroll).
  const cargandoInicial = loading && productos.length === 0;
  const resumen = resumenProductos(productos);
  const categorias = useMemo(() => categoriasDeProductos(productos), [productos]);
  const visibles = useMemo(
    () => filtrarProductos(productos, { texto, categoria, estado }),
    [productos, texto, categoria, estado]
  );

  const hayFiltros = texto !== "" || categoria !== null || estado !== "todos";
  const limpiarFiltros = () => {
    setTexto("");
    setCategoria(null);
    setEstado("todos");
  };

  return (
    <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3 lg:p-6">
      <div>
        <h1 className="text-title-sm font-bold text-gray-800 dark:text-white/90">Menú de productos</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Actualice precios y decida qué productos se muestran en caja.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <ResumenItem etiqueta="Total" valor={resumen.total} loading={cargandoInicial} />
        <ResumenItem etiqueta="Visibles en caja" valor={resumen.activos} loading={cargandoInicial} />
        <ResumenItem etiqueta="Ocultos" valor={resumen.inactivos} loading={cargandoInicial} />
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar por nombre o categoría"
              aria-label="Buscar productos"
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-11 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
          </div>

          <div
            role="group"
            aria-label="Filtrar por estado"
            className="inline-flex shrink-0 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900"
          >
            {FILTROS_ESTADO.map((f) => (
              <button
                key={f.valor}
                type="button"
                aria-pressed={estado === f.valor}
                onClick={() => setEstado(f.valor)}
                className={`flex-1 rounded-md px-3 py-2 text-theme-sm font-medium transition-colors sm:flex-none ${
                  estado === f.valor
                    ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                {f.etiqueta}
              </button>
            ))}
          </div>
        </div>

        {categorias.length > 0 && (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrar por categoría">
            <Chip activo={categoria === null} onClick={() => setCategoria(null)}>
              Todas
            </Chip>
            {categorias.map((c) => (
              <Chip key={c} activo={categoria === c} onClick={() => setCategoria(categoria === c ? null : c)}>
                {c}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {/* Sugerencias para el campo categoría del formulario de edición */}
      <datalist id={CATEGORIAS_LIST_ID}>
        {categorias.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="space-y-3">
        {!cargandoInicial && !error && productos.length > 0 && (
          <div className="flex items-center justify-between text-theme-sm text-gray-500 dark:text-gray-400">
            <span>
              {visibles.length === productos.length
                ? `${productos.length} productos`
                : `${visibles.length} de ${productos.length} productos`}
            </span>
            {hayFiltros && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="inline-flex items-center gap-1 font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {cargandoInicial ? (
          Array.from({ length: 4 }).map((_, i) => <ProductoSkeleton key={i} />)
        ) : error ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-2xl border border-error-200 bg-error-50 p-6 text-center text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400"
          >
            No se pudo cargar el menú.
            <Button size="sm" variant="outline" onClick={cargarProductos}>
              Reintentar
            </Button>
          </div>
        ) : productos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
            <p className="font-medium text-gray-800 dark:text-white/90">Todavía no hay productos</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Los productos aparecen aquí cuando se crean desde inventario.
            </p>
          </div>
        ) : visibles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
            <p className="font-medium text-gray-800 dark:text-white/90">Ningún producto coincide</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Pruebe con otra búsqueda o quite los filtros.</p>
            <div className="mt-4">
              <Button size="sm" variant="outline" onClick={limpiarFiltros}>
                Limpiar filtros
              </Button>
            </div>
          </div>
        ) : (
          visibles.map((producto) => (
            <ProductosCard
              key={producto.id}
              itemData={producto}
              categoriasListId={CATEGORIAS_LIST_ID}
              onSaved={cargarProductos}
            />
          ))
        )}
      </div>
    </div>
  );
}
