"use client";

import React, { useEffect, useState } from "react";
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

type Celda = string | number | null;
interface DatosReporte {
  cabeceras: string[];
  filas: Celda[][];
}

const formatearCelda = (valor: Celda) =>
  typeof valor === "number" ? valor.toLocaleString("es", { maximumFractionDigits: 2 }) : (valor ?? "");

interface TarjetaProps {
  icon: LucideIcon;
  titulo: string;
  descripcion: string;
  seleccionada: boolean;
  onSeleccionar: () => void;
  children?: React.ReactNode;
}

function TarjetaReporte({ icon: Icon, titulo, descripcion, seleccionada, onSeleccionar, children }: TarjetaProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={seleccionada}
      onClick={onSeleccionar}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSeleccionar();
        }
      }}
      className={`flex cursor-pointer flex-col gap-2 rounded-2xl border bg-white p-5 shadow-theme-xs transition dark:bg-gray-900/40 ${
        seleccionada
          ? "border-brand-500 ring-1 ring-brand-500"
          : "border-gray-200 hover:border-brand-300 dark:border-gray-800"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{titulo}</h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{descripcion}</p>
      {children}
    </div>
  );
}

function TablaReporte({ datos }: { datos: DatosReporte }) {
  if (datos.filas.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
        No hay datos para el periodo seleccionado.
      </p>
    );
  }
  return (
    <div className="max-h-[60vh] overflow-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
          <tr>
            {datos.cabeceras.map((c) => (
              <th
                key={c}
                className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {datos.filas.map((fila, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              {fila.map((celda, j) => (
                <td
                  key={j}
                  className={`whitespace-nowrap px-3 py-2 text-gray-700 dark:text-gray-300 ${
                    typeof celda === "number" ? "text-right tabular-nums" : ""
                  }`}
                >
                  {formatearCelda(celda)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TITULOS: Record<TipoReporte, string> = {
  usuario: "Ventas por usuario",
  caja: "Cajas",
  "producto-resumen": "Ventas por producto (resumen)",
  "producto-detalle": "Ventas por producto (detallado)",
  anuladas: "Ventas anuladas",
};

export default function ReporteVentasClient() {
  const [rango, setRango] = useState(() => rangoPreset("mes"));
  const [modoProducto, setModoProducto] = useState<"resumen" | "detalle">("resumen");
  const [seleccion, setSeleccion] = useState<"usuario" | "caja" | "producto" | "anuladas">("usuario");
  const [datos, setDatos] = useState<DatosReporte | null>(null);
  const [cargandoVista, setCargandoVista] = useState(false);
  const [errorVista, setErrorVista] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);

  const tipoProducto: TipoReporte = modoProducto === "resumen" ? "producto-resumen" : "producto-detalle";
  const tipo: TipoReporte = seleccion === "producto" ? tipoProducto : seleccion;
  const rangoValido = Boolean(rango.desde && rango.hasta);

  useEffect(() => {
    if (!rangoValido) {
      setDatos(null);
      setErrorVista("Selecciona las fechas desde y hasta.");
      return;
    }
    const controller = new AbortController();
    setCargandoVista(true);
    setErrorVista(null);
    const params = new URLSearchParams({ tipo, desde: rango.desde, hasta: rango.hasta, formato: "json" });
    fetch(`/api/admin/reportes/ventas?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setDatos(null);
          setErrorVista(data?.message || data?.error || "No se pudo cargar el reporte.");
          return;
        }
        setDatos(data as DatosReporte);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setDatos(null);
        setErrorVista("Error de conexión al cargar el reporte.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargandoVista(false);
      });
    return () => controller.abort();
  }, [tipo, rango.desde, rango.hasta, rangoValido]);

  const descargar = async () => {
    if (!rangoValido) {
      toast.error("Selecciona las fechas desde y hasta.");
      return;
    }
    setDescargando(true);
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
      setDescargando(false);
    }
  };

  const claseInput =
    "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Reporte de ventas</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Elige un reporte para ver sus datos del periodo y descárgalo en CSV (compatible con Excel).
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
          seleccionada={seleccion === "usuario"}
          onSeleccionar={() => setSeleccion("usuario")}
        />
        <TarjetaReporte
          icon={Wallet}
          titulo="Cajas"
          descripcion="Una fila por caja abierta en el periodo: ventas por método de pago, movimientos, efectivo esperado vs. contado y diferencias."
          seleccionada={seleccion === "caja"}
          onSeleccionar={() => setSeleccion("caja")}
        />
        <TarjetaReporte
          icon={Package}
          titulo="Ventas por producto"
          descripcion={
            modoProducto === "resumen"
              ? "Totales por producto: unidades, venta, costo real vs. teórico, margen y % de la venta."
              : "Una fila por línea vendida, con fecha, pedido, factura, método de pago y empleado."
          }
          seleccionada={seleccion === "producto"}
          onSeleccionar={() => setSeleccion("producto")}
        >
          <div onKeyDown={(e) => e.stopPropagation()} className="mt-1 inline-flex w-fit rounded-xl border border-gray-200 p-0.5 text-xs font-medium dark:border-gray-700">
            {(["resumen", "detalle"] as const).map((modo) => (
              <button
                key={modo}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setModoProducto(modo);
                  setSeleccion("producto");
                }}
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
          seleccionada={seleccion === "anuladas"}
          onSeleccionar={() => setSeleccion("anuladas")}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900/40 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{TITULOS[tipo]}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {rango.desde || "—"} a {rango.hasta || "—"}
              {datos && !cargandoVista ? ` · ${datos.filas.length} fila${datos.filas.length === 1 ? "" : "s"}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={descargar}
            disabled={descargando || !rangoValido}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {descargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {descargando ? "Generando..." : "Descargar CSV"}
          </button>
        </div>
        {cargandoVista ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando datos...
          </div>
        ) : errorVista ? (
          <p className="py-10 text-center text-sm text-red-600 dark:text-red-400">{errorVista}</p>
        ) : datos ? (
          <TablaReporte datos={datos} />
        ) : null}
      </div>
    </div>
  );
}
