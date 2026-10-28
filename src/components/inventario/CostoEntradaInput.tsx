"use client";

import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";

export type ModoCosto = "total" | "unitario";

const MODOS: { value: ModoCosto; label: string }[] = [
  { value: "total", label: "Costo total" },
  { value: "unitario", label: "Costo unitario" },
];

type Props = {
  modo: ModoCosto;
  onModoChange: (modo: ModoCosto) => void;
  valor: string;
  onValorChange: (valor: string) => void;
  // Cantidad tal cual la escribe el usuario; solo se usa para la vista previa.
  cantidad: string;
  unidad?: string;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Vista previa del unitario derivado del total. Solo se muestra; el cálculo
 * autoritativo (Decimal, 6 decimales) lo hace el servidor.
 */
function vistaPreviaUnitario(valor: string, cantidad: string, unidad?: string): string | undefined {
  if (valor.trim() === "" || cantidad.trim() === "") return undefined;
  const total = Number(valor);
  const qty = Number(cantidad);
  if (!Number.isFinite(total) || total < 0 || !Number.isFinite(qty) || qty <= 0) return undefined;
  const unitario = (total / qty).toLocaleString("es", { maximumFractionDigits: 6 });
  return `≈ ${unitario} por ${unidad?.trim() || "unidad"}`;
}

export default function CostoEntradaInput({
  modo,
  onModoChange,
  valor,
  onValorChange,
  cantidad,
  unidad,
  disabled = false,
  placeholder = "Ingrese el costo",
}: Props) {
  const hint = modo === "total" ? vistaPreviaUnitario(valor, cantidad, unidad) : undefined;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Label className="mb-0 text-black">
          {modo === "total" ? "Costo total" : "Costo unitario"}
        </Label>
        <div
          role="group"
          aria-label="Tipo de costo"
          className="inline-flex overflow-hidden rounded-lg border border-gray-300 text-xs dark:border-gray-700"
        >
          {MODOS.map((m) => (
            <button
              key={m.value}
              type="button"
              disabled={disabled}
              aria-pressed={modo === m.value}
              onClick={() => onModoChange(m.value)}
              className={`px-2.5 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                modo === m.value
                  ? "bg-brand-500 text-white"
                  : "bg-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <Input
        className="text-gray-dark"
        type="number"
        step="any"
        placeholder={placeholder}
        value={valor}
        onChange={(e) => onValorChange(e.target.value)}
        disabled={disabled}
        hint={hint}
      />
    </div>
  );
}
