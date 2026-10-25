"use client";

import { useState, useMemo } from "react";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";

const BILLETES = [200, 100, 50, 20, 10];
const MONEDAS = [5, 2, 1, 0.5, 0.2, 0.1];

export interface DetalleDenominacion {
  tipo: "Billete" | "Moneda";
  denominacion: number;
  cantidad: number;
  subtotal: number;
}

type Props = {
  title: string;
  subtitle: string;
  submitLabel: string;
  savingLabel: string;
  isSaving: boolean;
  onSubmit: (total: number, detalle: DetalleDenominacion[]) => void;
  onCancel?: () => void;
  /** Contenido extra renderizado arriba de la grilla de conteo (ej. resumen del sistema en el cierre). */
  topSlot?: React.ReactNode;
};

/**
 * Grilla de conteo físico de billetes/monedas, compartida entre apertura y
 * cierre de caja — es el mismo gesto operativo (contar el cajón), solo
 * cambia a qué endpoint va el total resultante.
 */
export default function DenominacionesForm({
  title,
  subtitle,
  submitLabel,
  savingLabel,
  isSaving,
  onSubmit,
  onCancel,
  topSlot,
}: Props) {
  const [counts, setCounts] = useState<Record<string, string>>({});

  const handleCountChange = (denomination: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d+$/.test(val)) {
      setCounts((prev) => ({ ...prev, [denomination]: val }));
    }
  };

  const { totalGeneral, detalle } = useMemo(() => {
    let total = 0;
    const items: DetalleDenominacion[] = [];

    const procesar = (denominaciones: number[], tipo: "Billete" | "Moneda") => {
      denominaciones.forEach((denom) => {
        const cantidad = parseInt(counts[denom] || "0", 10);
        if (cantidad > 0) {
          const subtotal = cantidad * denom;
          total += subtotal;
          items.push({ tipo, denominacion: denom, cantidad, subtotal });
        }
      });
    };

    procesar(BILLETES, "Billete");
    procesar(MONEDAS, "Moneda");

    return { totalGeneral: total, detalle: items };
  }, [counts]);

  return (
    <div className="w-full bg-white rounded-2xl p-6 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
      <div className="border-b border-gray-100 dark:border-gray-800 pb-6">
        <h4 className="mb-2 text-2xl font-bold text-gray-800 dark:text-white/90">{title}</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>

      {topSlot}

      <form className="flex flex-col" onSubmit={(e) => e.preventDefault()}>
        <div className="sticky top-0 z-10 -mx-2 px-2 pb-2 pt-4 bg-white/80 backdrop-blur-md dark:bg-gray-900/80">
          <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-5 rounded-xl border border-blue-100 dark:border-blue-800/30 shadow-sm">
            <span className="text-sm dark:text-blue-300 font-semibold uppercase tracking-wider">
              Total Efectivo Contado
            </span>
            <span className="text-4xl font-bold dark:text-blue-400 tabular-nums">
              Bs. {totalGeneral.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 mt-2">
          <div className="space-y-6 rounded-2xl dark:bg-white/3 bg-gray-50/50">
            <div className="space-y-4 p-4">
              {BILLETES.map((valor) => (
                <div key={`bill-${valor}`} className="flex items-center gap-4 group">
                  <div className="w-24 shrink-0">
                    <Label className="text-gray-700 dark:text-gray-200 font-bold text-base">Bs. {valor}</Label>
                  </div>
                  <div className="flex-1">
                    <Input
                      className="text-gray-900 dark:text-gray-100 text-right font-medium text-lg h-11"
                      placeholder="0"
                      value={counts[valor] || ""}
                      onChange={handleCountChange(valor)}
                      min="0"
                      type="tel"
                    />
                  </div>
                  <div className="w-28 text-right font-medium text-gray-500 dark:text-gray-400 tabular-nums">
                    Bs. {(parseInt(counts[valor] || "0", 10) * valor).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6 rounded-2xl dark:bg-white/3 bg-gray-50/50">
            <div className="space-y-4 p-4">
              {MONEDAS.map((valor) => (
                <div key={`coin-${valor}`} className="flex items-center gap-4 group">
                  <div className="w-24 shrink-0">
                    <Label className="text-gray-700 dark:text-gray-200 font-bold text-base">
                      Bs. {valor.toFixed(2)}
                    </Label>
                  </div>
                  <div className="flex-1">
                    <Input
                      className="text-gray-900 dark:text-gray-100 text-right font-medium text-lg h-11"
                      placeholder="0"
                      value={counts[valor] || ""}
                      onChange={handleCountChange(valor)}
                      min="0"
                      type="tel"
                    />
                  </div>
                  <div className="w-28 text-right font-medium text-gray-500 dark:text-gray-400 tabular-nums">
                    Bs. {(parseInt(counts[valor] || "0", 10) * valor).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={isSaving}>
              Cancelar
            </Button>
          )}
          <Button onClick={() => onSubmit(totalGeneral, detalle)} disabled={isSaving} className="px-8 min-w-[200px]">
            {isSaving ? savingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
