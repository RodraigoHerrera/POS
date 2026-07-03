"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Clock } from "lucide-react";

interface TopBarCajeroProps {
  empleadoNombre: string;
  /** ISO date de apertura de turno, para calcular la duración en vivo. */
  turnoInicio?: string;
  variant?: "default" | "contexto-pedido" | "simple";

  /** Solo variant="default" */
  cliente?: string;
  onClienteChange?: (cliente: string) => void;
  clienteDisabled?: boolean;

  /** Solo variant="contexto-pedido" */
  pedidoId?: string;
  onVolver?: () => void;

  /** Solo variant="simple" */
  titulo?: string;

  /** Si se omite, no se muestra el botón (ej. en apertura/cierre no aplica). */
  onCerrarCaja?: () => void;

  /** Si se omite, no se muestra el botón (comandas sin cobrar ni anular). */
  onVerPedidos?: () => void;
}

function useDuracionTurno(turnoInicio?: string) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!turnoInicio) return;
    const interval = setInterval(() => setAhora(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [turnoInicio]);

  if (!turnoInicio) return null;
  const inicio = new Date(turnoInicio).getTime();
  const minutos = Math.max(0, Math.floor((ahora - inicio) / 60_000));
  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;
  return `${horas.toString().padStart(2, "0")}:${minutosRestantes.toString().padStart(2, "0")}`;
}

/**
 * Barra persistente en las 4 pantallas de /cajero. Reemplaza el header
 * mínimo actual ("Punto de Venta" + "Cerrar Caja") dando identidad del
 * cajero, duración de turno y, según la pantalla, contexto del pedido o
 * un campo de cliente editable.
 */
export default function TopBarCajero({
  empleadoNombre,
  turnoInicio,
  variant = "default",
  cliente,
  onClienteChange,
  clienteDisabled,
  pedidoId,
  onVolver,
  titulo,
  onCerrarCaja,
  onVerPedidos,
}: TopBarCajeroProps) {
  const duracion = useDuracionTurno(turnoInicio);

  return (
    <header
      role="banner"
      className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-950"
    >
      <div className="flex items-center gap-4 min-w-0">
        {variant === "contexto-pedido" && onVolver ? (
          <button
            onClick={onVolver}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
          >
            <ArrowLeft size={16} />
            Volver al pedido
          </button>
        ) : (
          <span className="shrink-0 text-sm font-semibold text-gray-700 dark:text-gray-200">
            Smash POS
          </span>
        )}

        <span className="hidden shrink-0 text-sm text-gray-400 sm:inline" aria-hidden="true">
          ·
        </span>

        <span className="shrink-0 truncate text-sm text-gray-500 dark:text-gray-400">
          {empleadoNombre}
          {duracion && (
            <span className="ml-2 inline-flex items-center gap-1 text-gray-400">
              <Clock size={13} />
              {duracion}
            </span>
          )}
        </span>

        {variant === "contexto-pedido" && (
          <>
            <span className="hidden shrink-0 text-sm text-gray-400 sm:inline" aria-hidden="true">
              ·
            </span>
            <span className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">
              Pedido #{pedidoId}
              {cliente && <span className="text-gray-400"> · {cliente}</span>}
            </span>
          </>
        )}

        {variant === "simple" && titulo && (
          <>
            <span className="hidden shrink-0 text-sm text-gray-400 sm:inline" aria-hidden="true">
              ·
            </span>
            <span className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">
              {titulo}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {variant === "default" && (
          <label className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Cliente</span>
            <input
              type="text"
              value={cliente ?? ""}
              disabled={clienteDisabled}
              onChange={(e) => onClienteChange?.(e.target.value)}
              placeholder="Cliente Mostrador"
              aria-label="Nombre del cliente para este pedido"
              className="h-9 w-44 rounded-lg border border-gray-300 px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:disabled:bg-gray-800"
            />
          </label>
        )}

        {onVerPedidos && (
          <button
            onClick={onVerPedidos}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
          >
            Pedidos abiertos
          </button>
        )}

        {onCerrarCaja && (
          <button
            onClick={onCerrarCaja}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
          >
            Cerrar Caja
          </button>
        )}
      </div>
    </header>
  );
}
