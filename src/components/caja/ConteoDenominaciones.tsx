"use client";

import { useRef } from "react";
import { Minus, Plus } from "lucide-react";
import { BILLETES, MONEDAS, ajustarCantidad } from "@/lib/conteoCierre";

type Props = {
  /** Cantidades por denominación (clave = denominación como texto, ej. "0.5"). */
  counts: Record<string, string>;
  onChange: (denominacion: string, valor: string) => void;
};

const etiqueta = (valor: number, esMoneda: boolean) =>
  esMoneda ? `Bs. ${valor.toFixed(2)}` : `Bs. ${valor}`;

/**
 * Grilla controlada de conteo de billetes/monedas con steppers táctiles.
 * Compartida entre apertura y cierre de caja.
 */
export default function ConteoDenominaciones({ counts, onChange }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);

  // Enter avanza al siguiente campo de cantidad (no envía el formulario).
  const handleEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const inputs = Array.from(
      contenedor.current?.querySelectorAll<HTMLInputElement>("input[data-conteo]") ?? []
    );
    const idx = inputs.indexOf(e.currentTarget);
    if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus();
    else e.currentTarget.blur();
  };

  const renderFila = (valor: number, esMoneda: boolean) => {
    const clave = String(valor);
    const etq = etiqueta(valor, esMoneda);
    const cantidad = parseInt(counts[clave] || "0", 10) || 0;
    const subtotal = Math.round(cantidad * valor * 100) / 100;

    return (
      <div key={clave} className="flex items-center gap-2 py-1">
        <span className="w-16 shrink-0 text-base font-bold text-gray-700 dark:text-gray-200">
          {etq}
        </span>
        <button
          type="button"
          aria-label={`Quitar uno de ${etq}`}
          onClick={() => onChange(clave, ajustarCantidad(counts[clave] || "", -1))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-100 active:scale-95 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Minus size={18} />
        </button>
        <input
          data-conteo
          aria-label={`Cantidad ${etq}`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={counts[clave] || ""}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "" || /^\d+$/.test(val)) onChange(clave, val);
          }}
          onKeyDown={handleEnter}
          className="h-11 w-14 shrink-0 rounded-xl border-2 border-gray-200 text-center text-xl font-bold tabular-nums text-gray-900 focus:border-red-500 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
        <button
          type="button"
          aria-label={`Agregar uno de ${etq}`}
          onClick={() => onChange(clave, ajustarCantidad(counts[clave] || "", 1))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-100 active:scale-95 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Plus size={18} />
        </button>
        <span className="min-w-0 flex-1 truncate text-right text-sm font-medium tabular-nums text-gray-500 dark:text-gray-400">
          Bs. {subtotal.toFixed(2)}
        </span>
      </div>
    );
  };

  return (
    <div ref={contenedor} className="grid grid-cols-1 gap-x-10 gap-y-6 xl:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Billetes
        </h3>
        {BILLETES.map((v) => renderFila(v, false))}
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Monedas
        </h3>
        {MONEDAS.map((v) => renderFila(v, true))}
      </div>
    </div>
  );
}
