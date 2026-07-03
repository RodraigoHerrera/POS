"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ReceiptText, RefreshCw } from "lucide-react";
import TopBarCajero from "@/components/caja/TopBarCajero";

interface PedidoAbierto {
  id: string;
  mesa: string | null;
  cliente: string | null;
  estado: string;
  total: number;
  creadoEn: string;
  empleadoNombre: string;
  items: { cantidad: number; nombre: string }[];
}

interface SesionCaja {
  empleadoNombre: string;
  fechaApertura: string;
}

const ESTADO_BADGE: Record<string, string> = {
  PENDIENTE: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  COMANDADO: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  PREPARADO: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ENTREGADO: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

function tiempoTranscurrido(iso: string): string {
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `hace ${horas} h ${minutos % 60} min`;
}

export default function PedidosAbiertosPage() {
  const router = useRouter();

  const [sesionCaja, setSesionCaja] = useState<SesionCaja | null>(null);
  const [pedidos, setPedidos] = useState<PedidoAbierto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const fetchPedidos = useCallback(async () => {
    try {
      const res = await fetch("/api/caja/pedidosAbiertos", { credentials: "include" });
      const data = await res.json();
      if (res.ok) setPedidos(data.pedidos);
    } catch (error) {
      console.error("Error cargando pedidos abiertos:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/caja/resumen", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSesionCaja({ empleadoNombre: data.empleadoNombre, fechaApertura: data.fechaApertura });
      })
      .catch(() => {});

    fetchPedidos();
  }, [fetchPedidos]);

  const handleCobrar = (pedido: PedidoAbierto) => {
    router.push(
      `/cajero/metodos-pago?id=${pedido.id}&total=${pedido.total}&cliente=${encodeURIComponent(pedido.cliente ?? "")}`
    );
  };

  const handleAnular = async (pedido: PedidoAbierto) => {
    if (!confirm(`¿Anular el pedido #${pedido.id}? El stock descontado por la comanda se repondrá.`)) return;

    const motivo = prompt("Motivo de la anulación (opcional):") || undefined;

    try {
      setVoidingId(pedido.id);

      const response = await fetch("/api/caja/anularPedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId: pedido.id, motivo }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error desconocido al anular el pedido.");
      }

      await fetchPedidos();
    } catch (error: any) {
      console.error("Error anulando pedido:", error);
      alert(`❌ Error al anular: ${error.message}`);
    } finally {
      setVoidingId(null);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-gray-50 dark:bg-gray-900">
      <TopBarCajero
        variant="simple"
        titulo="Pedidos abiertos"
        empleadoNombre={sesionCaja?.empleadoNombre ?? ""}
        turnoInicio={sesionCaja?.fechaApertura}
        onCerrarCaja={() => router.push("/cajero/cierre")}
      />

      <div className="w-full flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => router.push("/cajero/ventas")}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <ArrowLeft size={16} />
              Nueva venta
            </button>

            <button
              onClick={() => { setIsLoading(true); fetchPedidos(); }}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-gray-400">
              <Loader2 className="animate-spin" size={28} />
              Cargando pedidos...
            </div>
          ) : pedidos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 py-24 text-center dark:border-gray-800">
              <ReceiptText size={32} className="text-gray-300 dark:text-gray-600" />
              <p className="font-medium text-gray-500 dark:text-gray-400">No hay pedidos abiertos</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Las comandas sin cobrar ni anular aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pedidos.map((pedido) => {
                const isVoiding = voidingId === pedido.id;
                return (
                  <div
                    key={pedido.id}
                    className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-gray-950"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-gray-900 dark:text-white">
                          Pedido #{pedido.id}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO_BADGE[pedido.estado] ?? ESTADO_BADGE.PENDIENTE}`}
                        >
                          {pedido.estado}
                        </span>
                        <span className="text-xs text-gray-400">{tiempoTranscurrido(pedido.creadoEn)}</span>
                      </div>

                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {pedido.cliente || "Cliente Mostrador"}
                        {pedido.mesa && <span className="text-gray-400"> · {pedido.mesa}</span>}
                        <span className="text-gray-400"> · atendió {pedido.empleadoNombre}</span>
                      </p>

                      <p className="mt-1 truncate text-sm text-gray-600 dark:text-gray-300">
                        {pedido.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(", ")}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        Bs {pedido.total.toFixed(2)}
                      </span>

                      <button
                        onClick={() => handleAnular(pedido)}
                        disabled={isVoiding || voidingId !== null}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-500 transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-400 dark:hover:border-red-700 dark:hover:text-red-400"
                      >
                        {isVoiding ? <Loader2 className="animate-spin" size={16} /> : "Anular"}
                      </button>

                      <button
                        onClick={() => handleCobrar(pedido)}
                        disabled={voidingId !== null}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Cobrar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
