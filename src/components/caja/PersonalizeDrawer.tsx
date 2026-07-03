"use client";

import React, { useEffect, useRef, useState } from "react";
import { Plus, Minus, X } from "lucide-react";
import type { Item, ExtraOption } from "./types";

interface PersonalizeDrawerProps {
  /** Producto a personalizar. null = drawer cerrado. */
  product: Item | null;
  onClose: () => void;
  onConfirm: (selection: { quantity: number; extras: ExtraOption[]; notes: string }) => void;
}

export default function PersonalizeDrawer({ product, onClose, onConfirm }: PersonalizeDrawerProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [availableExtras, setAvailableExtras] = useState<ExtraOption[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [extrasError, setExtrasError] = useState(false);

  const quantityInputRef = useRef<HTMLButtonElement>(null);

  const fetchExtras = (itemVendibleId: string) => {
    setLoadingExtras(true);
    setExtrasError(false);
    fetch(`/api/inventarios/modificadores?itemVendibleId=${itemVendibleId}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((data) =>
        setAvailableExtras(data.map((m: any) => ({ id: String(m.id), nombre: m.nombre, precio: Number(m.precio) })))
      )
      .catch(() => {
        setAvailableExtras([]);
        setExtrasError(true);
      })
      .finally(() => setLoadingExtras(false));
  };

  useEffect(() => {
    setQuantity(1);
    setSelectedExtraIds([]);
    setNotes("");
    setAvailableExtras([]);
    setExtrasError(false);

    if (!product) return;
    if (product.item_inventario_id) {
      fetchExtras(product.item_inventario_id);
    }
    // Foco inicial en el control de cantidad al abrir.
    const id = setTimeout(() => quantityInputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [product, onClose]);

  if (!product) return null;

  const toggleExtra = (id: string) => {
    setSelectedExtraIds((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  };

  const handleConfirm = () => {
    const extras = availableExtras.filter((e) => selectedExtraIds.includes(e.id));
    onConfirm({ quantity, extras, notes });
  };

  return (
    <>
      {/* Backdrop: atenúa el catálogo, cierra al hacer clic afuera */}
      <div
        className="absolute inset-0 z-30 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Personalizar ${product.nombre}`}
        className="absolute right-0 top-0 z-40 flex h-full w-full max-w-sm flex-col border-l border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-950"
      >
        <div className="flex items-start justify-between border-b border-gray-100 p-5 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">{product.nombre}</h2>
            <p className="text-sm font-semibold text-brand-500">Bs {parseFloat(product.precio).toFixed(2)}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar sin agregar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Cantidad</h3>
            <div className="flex items-center justify-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Disminuir cantidad"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-gray-700 transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-gray-700 dark:text-gray-200"
              >
                <Minus size={16} />
              </button>
              <span className="w-10 text-center text-xl font-bold text-gray-800 dark:text-white">{quantity}</span>
              <button
                ref={quantityInputRef}
                onClick={() => setQuantity((q) => q + 1)}
                aria-label="Aumentar cantidad"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-white transition hover:bg-brand-600"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Extras</h3>
            <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
              {loadingExtras ? (
                <p className="w-full text-center text-xs italic text-gray-400">Cargando extras...</p>
              ) : extrasError ? (
                <div className="w-full text-center">
                  <p className="text-xs text-error-500">No se pudieron cargar los extras.</p>
                  <button
                    onClick={() => product.item_inventario_id && fetchExtras(product.item_inventario_id)}
                    className="mt-1 text-xs font-medium text-brand-500 underline"
                  >
                    Reintentar
                  </button>
                </div>
              ) : availableExtras.length === 0 ? (
                <p className="w-full text-center text-xs italic text-gray-400">Sin extras disponibles.</p>
              ) : (
                availableExtras.map((extra) => (
                  <button
                    key={extra.id}
                    onClick={() => toggleExtra(extra.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      selectedExtraIds.includes(extra.id)
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-gray-300 bg-white text-gray-600 hover:border-brand-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {selectedExtraIds.includes(extra.id) ? "✓ " : "+ "}
                    {extra.nombre}
                    {extra.precio > 0 && ` (+Bs${extra.precio.toFixed(2)})`}
                  </button>
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Notas de cocina</h3>
            <textarea
              className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              rows={3}
              placeholder="Ej: Sin cebolla, carne bien cocida..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-100 p-5 dark:border-gray-800">
          <button
            onClick={handleConfirm}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-lg font-bold text-white shadow-lg transition hover:bg-brand-600"
          >
            + Agregar {quantity > 1 ? `${quantity} unidades` : ""}
          </button>
        </div>
      </div>
    </>
  );
}
