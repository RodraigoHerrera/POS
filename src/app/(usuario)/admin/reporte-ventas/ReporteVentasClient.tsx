"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Download,
  Loader2,
  Users,
  Wallet,
  Package,
  Ban,
  type LucideIcon,
} from "lucide-react";

type TipoReporte = "usuario" | "caja" | "producto-resumen" | "producto-detalle" | "anuladas";
type Preset = "hoy" | "7dias" | "mes" | "mesAnterior";

const pad = (n: number) => n.toString().padStart(2, "0");
const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function rangoPreset(preset: Preset): { desde: string; hasta: string } {
  const hoy = new Date();
  if (preset === "hoy") return { desde: formatDate(hoy), hasta: formatDate(hoy) };
  if (preset === "7dias") {
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - 6);
    return { desde: formatDate(inicio), hasta: formatDate(hoy) };
  }
  if (preset === "mes") {
    return { desde: formatDate(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: formatDate(hoy) };
  }
  return {
    desde: formatDate(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
    hasta: formatDate(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
  };
}

const PRESETS: { id: Preset; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "7dias", label: "Últimos 7 días" },
  { id: "mes", label: "Mes actual" },
  { id: "mesAnterior", label: "Mes anterior" },
];

interface TarjetaProps {
  icon: LucideIcon;
  titulo: string;
  descripcion: string;
  cargando: boolean;
  onDescargar: () => void;
  children?: React.ReactNode;
}

function TarjetaReporte({ icon: Icon, titulo, descripcion, cargando, onDescargar, children }: TarjetaProps) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900/40">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
            <Icon className="h-5 w-5" />
          </span>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{titulo}</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{descripcion}</p>
        {children}
      </div>
      <button
        type="button"
        onClick={onDescargar}
        disabled={cargando}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {cargando ? "Generando..." : "Descargar CSV"}
      </button>
    </div>
  );
}

export default function ReporteVentasClient() {
  const [rango, setRango] = useState(() => rangoPreset("mes"));
  const [modoProducto, setModoProducto] = useState<"resumen" | "detalle">("resumen");
  const [descargando, setDescargando] = useState<string | null>(null);

  const descargar = async (tipo: TipoReporte) => {
    if (!rango.desde || !rango.hasta) {
      toast.error("Selecciona las fechas desde y hasta.");
      return;
    }
    setDescargando(tipo);
    try {
      const params = new URLSearchParams({ tipo, desde: rango.desde, hasta: rango.hasta });
      const res = await fetch(`/api/admin/reportes/ventas?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || data?.error || "No se pudo generar el reporte.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_${tipo}_${rango.desde}_${rango.hasta}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Reporte descargado.");
    } catch {
      toast.error("Error de conexión al generar el reporte.");
    } finally {
      setDescargando(null);
    }
  };

  const tipoProducto: TipoReporte = modoProducto === "resumen" ? "producto-resumen" : "producto-detalle";
  const claseInput =
    "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Reporte de ventas</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Descarga reportes en CSV (compatibles con Excel) para el periodo elegido.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900/40 md:p-5">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
          <span className="mr-1 flex items-center gap-1 text-gray-500 dark:text-gray-400">
            <Calendar className="h-3.5 w-3.5" /> Periodo:
          </span>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setRango(rangoPreset(p.id))}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-gray-700 transition hover:border-brand-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/80"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:max-w-lg">
          <div>
            <label htmlFor="rv-desde" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Desde
            </label>
            <input
              id="rv-desde"
              type="date"
              value={rango.desde}
              max={rango.hasta || undefined}
              onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))}
              className={claseInput}
            />
          </div>
          <div>
            <label htmlFor="rv-hasta" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Hasta
            </label>
            <input
              id="rv-hasta"
              type="date"
              value={rango.hasta}
              min={rango.desde || undefined}
              onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))}
              className={claseInput}
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Rango máximo: 366 días.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TarjetaReporte
          icon={Users}
          titulo="Ventas por usuario"
          descripcion="Pedidos, unidades, venta, costo, margen y ticket promedio de cada empleado."
          cargando={descargando === "usuario"}
          onDescargar={() => descargar("usuario")}
        />
        <TarjetaReporte
          icon={Wallet}
          titulo="Cajas"
          descripcion="Una fila por caja abierta en el periodo: ventas por método de pago, movimientos, efectivo esperado vs. contado y diferencias."
          cargando={descargando === "caja"}
          onDescargar={() => descargar("caja")}
        />
        <TarjetaReporte
          icon={Package}
          titulo="Ventas por producto"
          descripcion={
            modoProducto === "resumen"
              ? "Totales por producto: unidades, venta, costo real vs. teórico, margen y % de la venta."
              : "Una fila por línea vendida, con fecha, pedido, factura, método de pago y empleado."
          }
          cargando={descargando === tipoProducto}
          onDescargar={() => descargar(tipoProducto)}
        >
          <div className="mt-1 inline-flex w-fit rounded-xl border border-gray-200 p-0.5 text-xs font-medium dark:border-gray-700">
            {(["resumen", "detalle"] as const).map((modo) => (
              <button
                key={modo}
                type="button"
                onClick={() => setModoProducto(modo)}
                aria-pressed={modoProducto === modo}
                className={`rounded-lg px-3 py-1.5 transition ${
                  modoProducto === modo
                    ? "bg-brand-500 text-white"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                {modo === "resumen" ? "Resumen" : "Detallado"}
              </button>
            ))}
          </div>
        </TarjetaReporte>
        <TarjetaReporte
          icon={Ban}
          titulo="Ventas anuladas"
          descripcion="Pedidos anulados en el periodo: quién los tomó, si estaban cobrados, método, total y motivo."
          cargando={descargando === "anuladas"}
          onDescargar={() => descargar("anuladas")}
        />
      </div>
    </div>
  );
}
