"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import {
  validarMovimientoCaja,
  RAZON_MAX,
  type TipoMovimientoManual,
} from "@/lib/movimientoCaja";

interface MovimientoManual {
  id: string;
  tipo: TipoMovimientoManual;
  monto: number;
  razon: string;
  creado_en: string;
}

interface Totales {
  entradasEfectivo: number;
  salidasEfectivo: number;
}

interface MovimientoCajaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const bs = (n: number) => `Bs ${n.toFixed(2)}`;

function hora(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function MovimientoCajaModal({ isOpen, onClose }: MovimientoCajaModalProps) {
  const [tipo, setTipo] = useState<TipoMovimientoManual>("ENTRADA");
  const [monto, setMonto] = useState("");
  const [razon, setRazon] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [movimientos, setMovimientos] = useState<MovimientoManual[]>([]);
  const [totales, setTotales] = useState<Totales>({ entradasEfectivo: 0, salidasEfectivo: 0 });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/caja/movimientos", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMovimientos(data.movimientos ?? []);
        setTotales({
          entradasEfectivo: data.entradasEfectivo ?? 0,
          salidasEfectivo: data.salidasEfectivo ?? 0,
        });
      }
    } catch (e) {
      console.error("Error cargando movimientos de caja:", e);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    void cargar();
  }, [isOpen, cargar]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    setError(null);

    let validado;
    try {
      validado = validarMovimientoCaja({ tipo, monto, razon });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Datos inválidos");
      return;
    }

    setGuardando(true);
    try {
      const res = await fetch("/api/caja/movimiento", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validado),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || data.error || "No se pudo registrar el movimiento");
        return;
      }
      setMonto("");
      setRazon("");
      await cargar();
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setGuardando(false);
    }
  };

  const esEntrada = tipo === "ENTRADA";

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg m-4">
      <form
        onSubmit={handleSubmit}
        className="space-y-5 p-6 sm:p-8"
        aria-labelledby="movimiento-titulo"
      >
        <div>
          <h2 id="movimiento-titulo" className="text-xl font-bold text-gray-800 dark:text-white">
            Movimiento de caja
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Registra efectivo que entra o sale del cajón fuera de las ventas.
          </p>
        </div>

        <div role="group" aria-label="Tipo de movimiento" className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={esEntrada}
            onClick={() => setTipo("ENTRADA")}
            className={`rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition ${
              esEntrada
                ? "border-green-500 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-900/20 dark:text-green-400"
                : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
            }`}
          >
            Entrada
          </button>
          <button
            type="button"
            aria-pressed={!esEntrada}
            onClick={() => setTipo("SALIDA")}
            className={`rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition ${
              !esEntrada
                ? "border-red-500 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-900/20 dark:text-red-400"
                : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
            }`}
          >
            Salida
          </button>
        </div>

        <div>
          <label htmlFor="movimiento-monto" className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-200">
            Monto
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">Bs</span>
            <input
              id="movimiento-monto"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              disabled={guardando}
              placeholder="0.00"
              className="w-full rounded-xl border-2 border-gray-200 py-3 pl-10 pr-4 text-2xl font-bold text-gray-900 focus:border-red-500 focus:ring-0 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label htmlFor="movimiento-razon" className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-200">
            Razón
          </label>
          <textarea
            id="movimiento-razon"
            rows={2}
            maxLength={RAZON_MAX}
            value={razon}
            onChange={(e) => setRazon(e.target.value)}
            disabled={guardando}
            placeholder={esEntrada ? "Ej. Cambio adicional" : "Ej. Pago a proveedor"}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-red-500 focus:ring-red-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <p className="mt-1 text-right text-xs text-gray-400">
            {razon.length}/{RAZON_MAX}
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {guardando && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
          Registrar movimiento
        </button>

        <section aria-label="Movimientos del turno" className="border-t border-gray-100 pt-4 dark:border-gray-800">
          <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-green-50 px-3 py-2 dark:bg-green-900/20">
              <p className="text-xs text-green-700 dark:text-green-400">Entradas</p>
              <p className="font-bold text-green-700 dark:text-green-400">{bs(totales.entradasEfectivo)}</p>
            </div>
            <div className="rounded-xl bg-red-50 px-3 py-2 dark:bg-red-900/20">
              <p className="text-xs text-red-700 dark:text-red-400">Salidas</p>
              <p className="font-bold text-red-700 dark:text-red-400">{bs(totales.salidasEfectivo)}</p>
            </div>
          </div>

          {cargando && movimientos.length === 0 ? (
            <p className="py-3 text-center text-sm text-gray-400">Cargando…</p>
          ) : movimientos.length === 0 ? (
            <p className="py-3 text-center text-sm text-gray-400">Aún no hay movimientos en este turno.</p>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {movimientos.map((m) => (
                <li
                  key={m.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2 text-sm dark:border-gray-800"
                >
                  <div className="min-w-0">
                    <p className="truncate text-gray-700 dark:text-gray-200">{m.razon}</p>
                    <p className="text-xs text-gray-400">{hora(m.creado_en)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        m.tipo === "ENTRADA"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {m.tipo === "ENTRADA" ? "Entrada" : "Salida"}
                    </span>
                    <span className="font-semibold text-gray-800 dark:text-white">{bs(m.monto)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </form>
    </Modal>
  );
}
