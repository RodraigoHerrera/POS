"use client";

import React, { useMemo, useState } from "react";
import { Search, MoreVertical } from "lucide-react";
import ProductCardSkeleton from "@/components/ui/skeleton/ProductCardSkeleton";
import type { Item } from "./types";

interface ProductCatalogGridProps {
  products: Item[];
  loading: boolean;
  /** Clic simple en la tarjeta: agrega 1 unidad sin extras de inmediato. */
  onQuickAdd: (product: Item) => void;
  /** "⋯" de la tarjeta: abre el drawer de personalización. */
  onCustomize: (product: Item) => void;
  /** ID del producto recién agregado, para el flash de confirmación. Lo controla el padre. */
  justAddedId?: number | null;
}

const TODAS = "Todas";

export default function ProductCatalogGrid({
  products,
  loading,
  onQuickAdd,
  onCustomize,
  justAddedId,
}: ProductCatalogGridProps) {
  const [query, setQuery] = useState("");
  const [categoria, setCategoria] = useState(TODAS);

  const categorias = useMemo(() => {
    const vistas = new Set(products.map((p) => p.categoria).filter(Boolean));
    return [TODAS, ...Array.from(vistas)];
  }, [products]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchCategoria = categoria === TODAS || p.categoria === categoria;
      const matchQuery = !q || p.nombre.toLowerCase().includes(q);
      return matchCategoria && matchQuery;
    });
  }, [products, query, categoria]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-3 border-b border-gray-200 p-4 dark:border-gray-800">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            placeholder="Buscar producto..."
            aria-label="Buscar producto"
            className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
        </div>

        {categorias.length > 1 && (
          <div role="tablist" aria-label="Filtrar por categoría" className="flex flex-wrap gap-2">
            {categorias.map((cat) => (
              <button
                key={cat}
                role="tab"
                aria-selected={categoria === cat}
                onClick={() => setCategoria(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  categoria === cat
                    ? "bg-brand-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
            <p>No hay productos disponibles.</p>
            <p className="text-sm">Contacta al administrador.</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-gray-400">
            <p>Sin resultados para &quot;{query}&quot;</p>
            <button
              onClick={() => setQuery("")}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Limpiar búsqueda
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {filtrados.map((item) => (
              <ProductTile
                key={item.id}
                item={item}
                justAdded={justAddedId === item.id}
                onQuickAdd={() => onQuickAdd(item)}
                onCustomize={() => onCustomize(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductTile({
  item,
  justAdded,
  onQuickAdd,
  onCustomize,
}: {
  item: Item;
  justAdded: boolean;
  onQuickAdd: () => void;
  onCustomize: () => void;
}) {
  return (
    <div
      className={`group relative rounded-xl border-2 bg-white transition-all dark:bg-gray-900 ${
        justAdded
          ? "border-success-400 ring-2 ring-success-200"
          : "border-gray-100 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
      }`}
    >
      <button
        onClick={onQuickAdd}
        aria-label={`Agregar ${item.nombre}, Bs ${parseFloat(item.precio).toFixed(2)}`}
        className="flex w-full flex-col gap-2 p-2 text-left"
      >
        <div className="relative h-28 w-full overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
          {item.fotoUrl ? (
            <img src={item.fotoUrl} alt={item.nombre} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400">
              <span className="text-xs">Sin Foto</span>
            </div>
          )}
        </div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight text-gray-800 line-clamp-2 dark:text-gray-200">
            {item.nombre}
          </h3>
          <span className="shrink-0 whitespace-nowrap text-sm font-bold text-brand-500">
            Bs {parseFloat(item.precio).toFixed(2)}
          </span>
        </div>
      </button>

      <button
        onClick={onCustomize}
        aria-label={`Personalizar ${item.nombre}`}
        title="Personalizar (cantidad, extras, notas)"
        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-400 opacity-70 shadow-sm transition-opacity hover:opacity-100 hover:bg-white hover:text-gray-700 focus:opacity-100 dark:bg-gray-900/90 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <MoreVertical size={14} />
      </button>
    </div>
  );
}
