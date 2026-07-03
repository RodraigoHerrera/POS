"use client";

import React, { useMemo } from "react";
import type { CartItem } from "./types";

interface CartCheckoutPanelProps {
  cart: CartItem[];
  onRemoveItem: (cartId: string) => void;
  onCancelOrder: () => void;
  onCommandOrder: () => void;
  isSubmitting: boolean;
}

function lineTotal(item: CartItem): number {
  const extrasPrice = item.extras.reduce((s, e) => s + e.precio, 0);
  return (parseFloat(item.product.precio) + extrasPrice) * item.quantity;
}

/**
 * Panel de carrito + acción terminal del pedido. "Comandar" es la acción que
 * se ejecuta en el 100% de los pedidos exitosos y debe dominar visualmente;
 * "Cancelar" es rara y destructiva, por eso es un link de texto, no un botón
 * del mismo tamaño.
 */
export default function CartCheckoutPanel({
  cart,
  onRemoveItem,
  onCancelOrder,
  onCommandOrder,
  isSubmitting,
}: CartCheckoutPanelProps) {
  const total = useMemo(() => cart.reduce((acc, item) => acc + lineTotal(item), 0), [cart]);

  return (
    <div className="flex h-full w-full flex-col border-l border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="shrink-0 border-b border-gray-100 p-4 dark:border-gray-800">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Pedido Actual</h2>
        <span className="text-sm text-gray-500">{cart.length} ítems</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {cart.length === 0 ? (
          <div className="mt-10 text-center text-gray-400 italic">Pedido vacío</div>
        ) : (
          cart.map((item) => (
            <div
              key={item.cartId}
              className="relative rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm transition-colors hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
            >
              <div className="flex justify-between font-medium text-gray-800 dark:text-gray-200">
                <span>
                  {item.quantity > 1 ? `${item.quantity}x ` : ""}
                  {item.product.nombre}
                </span>
                <span>Bs {lineTotal(item).toFixed(2)}</span>
              </div>
              {item.extras.length > 0 && (
                <div className="mt-1 text-xs text-brand-500">
                  + {item.extras.map((e) => (e.precio > 0 ? `${e.nombre} (+Bs${e.precio.toFixed(2)})` : e.nombre)).join(", ")}
                </div>
              )}
              {item.notes && <div className="mt-1 text-xs italic text-gray-500">&quot;{item.notes}&quot;</div>}
              <button
                onClick={() => onRemoveItem(item.cartId)}
                disabled={isSubmitting}
                aria-label={`Quitar ${item.product.nombre} del pedido`}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-600 shadow-sm hover:bg-red-200"
              >
                <span className="text-xs font-bold">✕</span>
              </button>
            </div>
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
        <div
          className="mb-4 flex justify-between text-xl font-bold text-gray-800 dark:text-gray-100"
          aria-live="polite"
        >
          <span>Subtotal:</span>
          <span>Bs {total.toFixed(2)}</span>
        </div>

        <button
          onClick={onCommandOrder}
          disabled={isSubmitting || cart.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
        >
          {isSubmitting ? <span className="animate-pulse">Enviando...</span> : "Comandar"}
        </button>

        {cart.length > 0 && (
          <button
            onClick={onCancelOrder}
            disabled={isSubmitting}
            className="mt-3 w-full text-center text-sm text-gray-500 underline-offset-2 hover:underline disabled:opacity-50"
          >
            Cancelar pedido
          </button>
        )}
      </div>
    </div>
  );
}
