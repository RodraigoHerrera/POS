"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import DatePicker from "@/components/form/date-picker";
import { rangoDesdeSeleccion } from "@/lib/rangoFechas";
import {
  Calendar,
  Download,
  Loader2,
  Users,
  Wallet,
  Package,
  Ban,
  SearchX,
  type LucideIcon,
} from "lucide-react";

type TipoReporte = "usuario" | "caja" | "producto-resumen" | "producto-detalle" | "anuladas";
type Seleccion = "usuario" | "caja" | "producto" | "anuladas";
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
  { id: "7dias", label: "7 días" },
  { id: "mes", label: "Mes actual" },
  { id: "mesAnterior", label: "Mes anterior" },
];

const REPORTES: { id: Seleccion; label: string; icon: LucideIcon }[] = [
  { id: "usuario", label: "Por usuario", icon: Users },
  { id: "caja", label: "Cajas", icon: Wallet },
  { id: "producto", label: "Por producto", icon: Package },
  { id: "anuladas", label: "Anuladas", icon: Ban },
];

const INFO: Record<TipoReporte, { titulo: string; descripcion: string }> = {
  usuario: {
    titulo: "Ventas por usuario",
    descripcion: "Pedidos, unidades, venta, costo, margen y ticket promedio de cada empleado.",
  },
  caja: {
    titulo: "Cajas",
    descripcion:
      "Una fila por caja abierta: ventas por método de pago, movimientos, efectivo esperado vs. contado y diferencias.",
  },
  "producto-resumen": {
    titulo: "Ventas por producto",
    descripcion: "Totales por producto: unidades, venta, costo real vs. teórico, margen y % de la venta.",
  },
  "producto-detalle": {
    titulo: "Ventas por producto",
    descripcion: "Una fila por línea vendida, con fecha, pedido, factura, método de pago y empleado.",
  },
  anuladas: {
    titulo: "Ventas anuladas",
    descripcion: "Pedidos anulados: quién los tomó, si estaban cobrados, método, total y motivo.",
  },
};

type Celda = string | number | null;
interface DatosReporte {
  cabeceras: string[];
  filas: Celda[][];
  total: number;
  truncado: boolean;
}

const formatearCelda = (valor: Celda) =>
  typeof valor === "number" ? valor.toLocaleString("es", { maximumFractionDigits: 2 }) : (valor ?? "");

const formatearDia = (dia: string) => {
  if (!dia) return "—";
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
};

function TablaSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-gray-100 dark:divide-gray-800/60">
      <div className="h-11 bg-gray-50/75 dark:bg-gray-800/40" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-6 px-4 py-3.5">
          <div className="h-4 w-1/4 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-4 w-1/6 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-4 w-1/6 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="ml-auto h-4 w-1/12 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
      ))}
    </div>
  );
}

interface EstadoVacioProps {
  icon: LucideIcon;
  titulo: string;
  texto?: string;
  error?: boolean;
}

function EstadoVacio({ icon: Icon, titulo, texto, error }: EstadoVacioProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-20 text-center">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
          error
            ? "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400"
            : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
        }`}
      >
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{titulo}</p>
        {texto && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{texto}</p>}
      </div>
    </div>
  );
}

function TablaReporte({ datos }: { datos: DatosReporte }) {
  // A column is numeric when every non-empty cell is a number; the header aligns with it.
  const numericas = datos.cabeceras.map((_, j) =>
    datos.filas.every((f) => f[j] === null || f[j] === "" || typeof f[j] === "number")
  );
  return (
    <div className="max-h-[calc(100vh-18rem)] min-h-[20rem] overflow-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-400">
            {datos.cabeceras.map((c, j) => (
              <th key={c} className={`whitespace-nowrap px-4 py-3.5 ${numericas[j] ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
          {datos.filas.map((fila, i) => (
            <tr key={i} className="transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/30">
              {fila.map((celda, j) => (
                <td
                  key={j}
                  className={`whitespace-nowrap px-4 py-3 ${
                    j === 0
                      ? "font-semibold text-gray-900 dark:text-white"
                      : numericas[j]
                        ? "text-right tabular-nums text-gray-700 dark:text-gray-300"
                        : "text-gray-600 dark:text-gray-400"
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

export default function ReporteVentasClient() {
  const [rango, setRango] = useState(() => rangoPreset("mes"));
  const [modoProducto, setModoProducto] = useState<"resumen" | "detalle">("resumen");
  const [seleccion, setSeleccion] = useState<Seleccion>("usuario");
  const [datos, setDatos] = useState<DatosReporte | null>(null);
  const [cargandoVista, setCargandoVista] = useState(false);
  const [errorVista, setErrorVista] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);

  const tipoProducto: TipoReporte = modoProducto === "resumen" ? "producto-resumen" : "producto-detalle";
  const tipo: TipoReporte = seleccion === "producto" ? tipoProducto : seleccion;
  const rangoValido = Boolean(rango.desde && rango.hasta);
  const presetActivo = PRESETS.find((p) => {
    const r = rangoPreset(p.id);
    return r.desde === rango.desde && r.hasta === rango.hasta;
  })?.id;

  useEffect(() => {
    if (!rango.desde || !rango.hasta) {
      setDatos(null);
      setErrorVista("Selecciona las fechas desde y hasta.");
      return;
    }
    const controller = new AbortController();
    setCargandoVista(true);
    setErrorVista(null);
    const params = new URLSearchParams({
      tipo,
      desde: rango.desde,
      hasta: rango.hasta,
      formato: "json",
    });
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
  }, [tipo, rango]);

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

  const info = INFO[tipo];
  const totalFilas = datos?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-title-sm font-bold text-gray-900 dark:text-white">
            Reporte de ventas
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Consulta el reporte del periodo y descárgalo en CSV (compatible con Excel).
          </p>
        </div>
        <button
          type="button"
          onClick={descargar}
          disabled={descargando || !rangoValido}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {descargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {descargando ? "Generando..." : "Descargar CSV"}
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900/40 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Tipo de reporte"
          className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
        >
          {REPORTES.map(({ id, label, icon: Icon }) => {
            const activo = seleccion === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activo}
                onClick={() => setSeleccion(id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  activo
                    ? "bg-white text-brand-600 shadow-theme-xs dark:bg-gray-900 dark:text-brand-400"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="hidden h-4 w-4 text-gray-400 sm:block" />
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setRango(rangoPreset(p.id))}
              aria-pressed={presetActivo === p.id}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                presetActivo === p.id
                  ? "border-brand-500 bg-brand-500/50 dark:border-brand-500/60 dark:bg-brand-500/10 dark:text-brand-300"
                  : "border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/80"
              }`}
            >
              {p.label}
            </button>
          ))}
          <div className="w-full sm:w-64">
            <DatePicker
              id="rv-periodo"
              mode="range"
              placeholder="Desde – hasta"
              value={[rango.desde, rango.hasta]}
              onChange={(fechas) => {
                const r = rangoDesdeSeleccion(fechas);
                if (r?.desde) setRango(r);
              }}
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900/40">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{info.titulo}</h2>
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {formatearDia(rango.desde)} – {formatearDia(rango.hasta)}
              </span>
              {datos && !cargandoVista && (
                <span className="rounded-md bg-brand-700/20 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
                  {totalFilas} {totalFilas === 1 ? "fila" : "filas"}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{info.descripcion}</p>
          </div>
          {seleccion === "producto" && (
            <div className="inline-flex w-fit shrink-0 rounded-xl border border-gray-200 p-0.5 text-xs font-medium dark:border-gray-700">
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
          )}
        </div>

        {cargandoVista ? (
          <TablaSkeleton />
        ) : errorVista ? (
          <EstadoVacio icon={Ban} titulo={errorVista} error />
        ) : datos && datos.filas.length === 0 ? (
          <EstadoVacio icon={SearchX} titulo="Sin datos en este periodo" texto="Prueba con otro rango de fechas." />
        ) : datos ? (
          <TablaReporte datos={datos} />
        ) : null}

        {datos?.truncado && !cargandoVista && (
          <div className="border-t border-amber-200 bg-amber-50 px-5 py-2.5 text-xs font-medium text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            Mostrando las primeras {datos.filas.length.toLocaleString("es")} de {datos.total.toLocaleString("es")} filas.
            Descarga el CSV para ver el reporte completo.
          </div>
        )}

        <div className="border-t border-gray-100 px-5 py-2.5 text-xs text-gray-400 dark:border-gray-800">
          Rango máximo: 366 días.
        </div>
      </div>
    </div>
  );
}
