"use client";

import React, { useState } from "react";
import { EcommerceMetrics } from "@/components/ecommerce/EcommerceMetrics";
import MonthlyTarget from "@/components/ecommerce/MonthlyTarget";
import DashboardAlertasYTop from "@/components/dashboard/DashboardAlertasYTop";
import type { Periodo } from "@/lib/periodo";

const OPCIONES: { value: Periodo; label: string }[] = [
  { value: "mes", label: "Mes" },
  { value: "semana", label: "Semana" },
];

/**
 * Contenedor cliente del dashboard: guarda el periodo seleccionado
 * (Mes/Semana) y se lo pasa a los widgets que consultan ventas.
 * Renderiza celdas del grid de 12 columnas de la página (la página sigue
 * siendo un server component para conservar `metadata`).
 */
export default function DashboardPeriodo() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");

  return (
    <>
      <div className="col-span-12 flex justify-end">
        <div
          role="group"
          aria-label="Periodo del dashboard"
          className="inline-flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900"
        >
          {OPCIONES.map((op) => (
            <button
              key={op.value}
              type="button"
              aria-pressed={periodo === op.value}
              onClick={() => setPeriodo(op.value)}
              className={`rounded-md px-3 py-2 text-theme-sm font-medium transition-colors ${
                periodo === op.value
                  ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {/* Antes había un hueco vacío debajo de las 2 KPI cards cortas
          (EcommerceMetrics) porque la celda no estiraba. Ahora se llena con
          alertas de stock + top productos, apiladas en la misma columna. */}
      <div className="col-span-12 space-y-4 xl:col-span-8 md:space-y-6">
        <EcommerceMetrics periodo={periodo} />
        <DashboardAlertasYTop periodo={periodo} />
      </div>

      <div className="col-span-12 xl:col-span-4">
        <MonthlyTarget periodo={periodo} />
      </div>
    </>
  );
}
