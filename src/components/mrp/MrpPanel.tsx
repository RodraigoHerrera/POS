"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Badge from "@/components/ui/badge/Badge";
import { Skeleton } from "@/components/ui/skeleton/Skeleton";
import TableRowSkeleton from "@/components/ui/skeleton/TableRowSkeleton";
import {
  BoxCubeIcon,
  AlertIcon,
  CheckCircleIcon,
  TimeIcon,
  DollarLineIcon,
  GroupIcon,
  PieChartIcon,
  ChevronDownIcon,
} from "@/icons";

interface ForecastDisplay {
  nombre: string;
  cantidadHorizonte: number;
  mpsQty: number;
  mapePct: number | null;
  metodo: string;
}

interface NecesidadDisplay {
  itemId: string;
  nombre: string;
  necesidadBruta: number;
  stockActual: number;
  stockSeguridad: number;
  necesidadNeta: number;
  fechaSugeridaEmision: string;
  proveedorNombre: string | null;
  observaciones: string | null;
  mapeBlendPct?: number | null;
}

interface OrdenDisplay {
  id: string;
  proveedorNombre: string;
  total: number;
  estado: string;
  items: { nombre: string; cantidad: number; costoUnit: number }[];
}

interface CorridaResumen {
  id: string;
  horizonte_dias: number;
  metodo: string;
  creado_en: string;
  _count: { necesidades: number; ordenesGeneradas: number };
}

interface ResultadoMrp {
  corridaId: string;
  horizonteDias: number;
  mensaje?: string;
  forecast: ForecastDisplay[];
  necesidades: NecesidadDisplay[];
  ordenesGeneradas: OrdenDisplay[];
  sinProveedor: { itemId: string; necesidadNeta: number }[];
  advertencias: { itemId: string; mensaje: string }[];
}

const METODO_LABEL: Record<string, string> = {
  suavizacion_exponencial: "Suavización exponencial",
  promedio_simple_baja_confianza: "Promedio simple (baja confianza)",
  sin_datos: "Sin datos",
};

const HORIZONTE_PRESETS = [7, 14, 30, 60];

function normalizarCorridaHistorica(data: any): ResultadoMrp {
  return {
    corridaId: data.id,
    horizonteDias: data.horizonte_dias,
    forecast: (data.forecastDetalle ?? []).map((f: any) => ({
      nombre: f.producto?.nombre ?? f.producto_id,
      cantidadHorizonte: Number(f.cantidad_pronosticada),
      mpsQty: Number(f.mps_qty),
      mapePct: f.mape_pct !== null ? Number(f.mape_pct) : null,
      metodo: "suavizacion_exponencial",
    })),
    necesidades: (data.necesidades ?? []).map((n: any) => ({
      itemId: n.item_id,
      nombre: n.item?.nombre ?? n.item_id,
      necesidadBruta: Number(n.necesidad_bruta),
      stockActual: Number(n.stock_actual),
      stockSeguridad: Number(n.stock_seguridad),
      necesidadNeta: Number(n.necesidad_neta),
      fechaSugeridaEmision: n.fecha_sugerida_emision,
      proveedorNombre: null,
      observaciones: n.observaciones,
      mapeBlendPct: null,
    })),
    ordenesGeneradas: (data.ordenesGeneradas ?? []).map((o: any) => ({
      id: o.id,
      proveedorNombre: o.proveedor?.nombre ?? "—",
      total: Number(o.total),
      estado: o.estado,
      items: (o.items ?? []).map((it: any) => ({
        nombre: it.item?.nombre ?? it.item_id,
        cantidad: Number(it.cantidad),
        costoUnit: Number(it.costo_unit),
      })),
    })),
    sinProveedor: [],
    advertencias: [],
  };
}

/** Tarjeta compacta de métrica para el resumen posterior a una corrida. */
function StatCard({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-300",
    success: "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400",
    warning: "bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-400",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3">
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-lg font-semibold text-gray-800 dark:text-white/90 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

export default function MrpPanel() {
  const [horizonteDias, setHorizonteDias] = useState(7);
  const [ejecutando, setEjecutando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoMrp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const [historial, setHistorial] = useState<CorridaResumen[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [corridaSeleccionada, setCorridaSeleccionada] = useState<string | null>(null);
  const [verTodoHistorial, setVerTodoHistorial] = useState(false);

  const HISTORIAL_LIMITE = 5;

  const cargarHistorial = useCallback(async () => {
    setCargandoHistorial(true);
    try {
      const res = await fetch("/api/mrp/corridas");
      const data = await res.json();
      if (data.success) setHistorial(data.data);
    } catch (e) {
      console.error("Error cargando historial de corridas MRP:", e);
    } finally {
      setCargandoHistorial(false);
    }
  }, []);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  const ejecutarMrp = async () => {
    setEjecutando(true);
    setError(null);
    setExito(null);
    try {
      const res = await fetch("/api/mrp/ejecutar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horizonteDias }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Error al ejecutar el MRP");
        return;
      }
      setResultado({
        ...data,
        ordenesGeneradas: (data.ordenesGeneradas ?? []).map((o: any) => ({
          id: o.id,
          proveedorNombre: o.proveedor?.nombre ?? "—",
          total: Number(o.total),
          estado: o.estado,
          items: (o.items ?? []).map((it: any) => ({
            nombre: it.item?.nombre ?? it.item_id,
            cantidad: Number(it.cantidad),
            costoUnit: Number(it.costo_unit),
          })),
        })),
      });
      setCorridaSeleccionada(null);
      setExito(
        data.mensaje
          ? null
          : `MRP ejecutado correctamente · corrida #${data.corridaId}`
      );
      cargarHistorial();
    } catch (e) {
      console.error("Error ejecutando MRP:", e);
      setError("Error de red al ejecutar el MRP");
    } finally {
      setEjecutando(false);
    }
  };

  const verCorrida = async (id: string) => {
    setCorridaSeleccionada(id);
    setResultado(null);
    setError(null);
    setExito(null);
    try {
      const res = await fetch(`/api/mrp/corridas/${id}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "No se pudo cargar la corrida");
        return;
      }
      setResultado(normalizarCorridaHistorica(data.data));
    } catch (e) {
      console.error("Error cargando corrida MRP:", e);
      setError("Error de red al cargar la corrida");
    }
  };

  // --- Derivados de solo presentación (no tocan la lógica de negocio) ---
  const lookupNombreInsumo = (itemId: string) =>
    resultado?.necesidades.find((n) => n.itemId === itemId)?.nombre ?? `Insumo #${itemId}`;

  const insumosConNecesidad = resultado?.necesidades.filter((n) => n.necesidadNeta > 0).length ?? 0;
  const montoTotalOC =
    resultado?.ordenesGeneradas.reduce((acc, o) => acc + o.total, 0) ?? 0;
  const horizonteExcedeMaximo = horizonteDias > 60;

  // Una OC tiene un insumo cuyo pronóstico es poco confiable si alguno de sus
  // items (cross-referenciado por nombre contra las necesidades de la corrida) supera el umbral de MAPE.
  const ordenTieneInsumoPocoConfiable = (orden: OrdenDisplay) =>
    orden.items.some((it) =>
      resultado?.necesidades.some(
        (n) => n.nombre === it.nombre && n.mapeBlendPct != null && n.mapeBlendPct > 30
      )
    );

  const historialVisible = verTodoHistorial ? historial : historial.slice(0, HISTORIAL_LIMITE);

  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-36">
              <Label className="text-xs mb-1">Horizonte (días)</Label>
              <Input
                type="number"
                min="1"
                max="60"
                value={horizonteDias}
                onChange={(e) => setHorizonteDias(Number(e.target.value) || 7)}
              />
              {horizonteExcedeMaximo && (
                <p className="mt-1 text-xs text-warning-600 dark:text-warning-400">
                  Máx. 60 días — se ajustará automáticamente.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400 dark:text-gray-500">Atajos</span>
              <div className="flex gap-1.5">
                {HORIZONTE_PRESETS.map((dias) => (
                  <button
                    key={dias}
                    type="button"
                    onClick={() => setHorizonteDias(dias)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      horizonteDias === dias
                        ? "bg-brand-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
                    }`}
                  >
                    {dias}d
                  </button>
                ))}
              </div>
            </div>

            <Button size="sm" startIcon={<BoxCubeIcon />} onClick={ejecutarMrp} disabled={ejecutando}>
              {ejecutando ? "Ejecutando MRP..." : "Ejecutar MRP"}
            </Button>
          </div>
        </div>
        <p className="mt-4 border-t border-gray-100 pt-3 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
          Pronostica demanda con los últimos 60 días de ventas, la traduce en MPS y
          explota las recetas para sugerir órdenes de compra en Borrador.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
          <AlertIcon className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {exito && (
        <div className="flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">
          <CheckCircleIcon className="size-4 shrink-0" />
          {exito}
        </div>
      )}

      {/* Estado vacío inicial */}
      {!resultado && !ejecutando && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-800 dark:bg-white/3">
          <div className="flex size-12 items-center justify-center rounded-full bg-gray-50 text-gray-400 dark:bg-white/5 dark:text-gray-500">
            <PieChartIcon className="size-6" />
          </div>
          <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
            Ejecuta el MRP para ver el pronóstico de demanda, las necesidades de
            insumos y las órdenes de compra sugeridas.
          </p>
        </div>
      )}

      {/* Loading skeleton de resultados */}
      {ejecutando && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      )}

      {resultado && !ejecutando && (
        <>
          {resultado.mensaje && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-white/5 dark:text-gray-300">
              <AlertIcon className="size-4 shrink-0 text-gray-400" />
              {resultado.mensaje}
            </div>
          )}

          {resultado.advertencias.length > 0 && (
            <div className="space-y-1 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
              {resultado.advertencias.map((a, i) => (
                <p key={i}>⚠ {a.mensaje}</p>
              ))}
            </div>
          )}

          {/* Resumen de la corrida */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              icon={<PieChartIcon className="size-5" />}
              label="Productos pronosticados"
              value={String(resultado.forecast.length)}
            />
            <StatCard
              icon={<GroupIcon className="size-5" />}
              label="Insumos con necesidad"
              value={String(insumosConNecesidad)}
            />
            <StatCard
              icon={<AlertIcon className="size-5" />}
              label="Sin proveedor"
              value={String(resultado.sinProveedor.length)}
              tone={resultado.sinProveedor.length > 0 ? "warning" : "default"}
            />
            <StatCard
              icon={<DollarLineIcon className="size-5" />}
              label="OC generadas"
              value={`${resultado.ordenesGeneradas.length} · Bs ${montoTotalOC.toFixed(2)}`}
              tone={resultado.ordenesGeneradas.length > 0 ? "success" : "default"}
            />
          </div>

          {/* Pronóstico + MPS */}
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
            <div className="border-b border-gray-200 px-5 py-3 dark:border-gray-800">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Pronóstico y MPS ({resultado.horizonteDias} días)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Producto</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Demanda pronosticada</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">MPS (a producir)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">MAPE</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Método</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {resultado.forecast.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                        Sin demanda pronosticada para el horizonte seleccionado.
                      </td>
                    </tr>
                  ) : (
                    resultado.forecast.map((f, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-white">{f.nombre}</td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-600 dark:text-gray-300">{f.cantidadHorizonte.toFixed(1)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-gray-800 dark:text-white">{f.mpsQty}</td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums">
                          {f.mapePct !== null ? (
                            <span
                              className={
                                f.mapePct > 30
                                  ? "text-warning-600 dark:text-warning-400"
                                  : "text-success-600 dark:text-success-400"
                              }
                            >
                              {f.mapePct.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {METODO_LABEL[f.metodo] ?? f.metodo}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Necesidades */}
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
            <div className="border-b border-gray-200 px-5 py-3 dark:border-gray-800">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Necesidades de insumos
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Insumo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Bruta</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Stock</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Seguridad</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Neta</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Proveedor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Emisión sugerida</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {resultado.necesidades.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                        Sin necesidades de insumos para esta corrida.
                      </td>
                    </tr>
                  ) : (
                    resultado.necesidades.map((n, i) => {
                      const requiereCompra = n.necesidadNeta > 0;
                      return (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5">
                          <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-white">
                            <span className="flex items-center gap-2">
                              <span
                                className={`size-1.5 shrink-0 rounded-full ${
                                  requiereCompra ? "bg-warning-500" : "bg-success-500"
                                }`}
                                title={requiereCompra ? "Requiere compra" : "Cubierto con stock"}
                              />
                              {n.nombre}
                              {n.mapeBlendPct != null && n.mapeBlendPct > 30 && (
                                <Badge color="warning" size="sm">
                                  Pronóstico poco confiable
                                </Badge>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-600 dark:text-gray-300">{n.necesidadBruta.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-600 dark:text-gray-300">{n.stockActual.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-600 dark:text-gray-300">{n.stockSeguridad.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                            <span className={requiereCompra ? "text-warning-600 dark:text-warning-400" : "text-gray-400"}>
                              {n.necesidadNeta.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                            {n.proveedorNombre ?? (
                              <Badge color="warning" size="sm">
                                Sin proveedor
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                            {new Date(n.fechaSugeridaEmision).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                            {n.observaciones ?? "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Órdenes de compra generadas */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
            <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">
              Órdenes de compra (Borrador)
            </h3>
            {resultado.ordenesGeneradas.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No se generó ninguna orden de compra en esta corrida.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {resultado.ordenesGeneradas.map((o) => (
                  <div key={o.id} className="rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                      <span className="font-semibold text-gray-800 dark:text-white">
                        OC #{o.id} · {o.proveedorNombre}
                      </span>
                      <div className="flex items-center gap-2">
                        {ordenTieneInsumoPocoConfiable(o) && (
                          <Badge color="warning" size="sm">
                            Pronóstico poco confiable
                          </Badge>
                        )}
                        <Badge color="warning" size="sm">
                          {o.estado}
                        </Badge>
                      </div>
                    </div>
                    <ul className="space-y-1.5 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {o.items.map((it, i) => (
                        <li key={i} className="flex justify-between gap-3">
                          <span className="truncate">{it.nombre}</span>
                          <span className="shrink-0 tabular-nums">{it.cantidad.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm dark:border-gray-800">
                      <span className="text-gray-500 dark:text-gray-400">Total</span>
                      <span className="font-semibold tabular-nums text-gray-800 dark:text-white">
                        Bs {o.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {resultado.sinProveedor.length > 0 && (
              <div className="mt-4 rounded-lg border border-warning-200 bg-warning-50 p-4 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
                <p className="mb-2 flex items-center gap-2 font-medium">
                  <AlertIcon className="size-4 shrink-0" />
                  Insumos sin proveedor asignado (no se generó OC)
                </p>
                <ul className="mb-2 space-y-1">
                  {resultado.sinProveedor.map((s, i) => (
                    <li key={i} className="flex justify-between gap-3 pl-1">
                      <span>{lookupNombreInsumo(s.itemId)}</span>
                      <span className="tabular-nums">necesidad neta {s.necesidadNeta.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <p className="border-t border-warning-200/60 pt-2 text-xs dark:border-warning-500/20">
                  Registra una entrada de inventario para estos insumos y selecciona su
                  proveedor — quedará vinculado para que las próximas corridas del MRP
                  puedan generar la orden de compra automáticamente.
                </p>
                <Link
                  href="/admin/inventario"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-warning-700 underline hover:text-warning-800 dark:text-warning-400 dark:hover:text-warning-300"
                >
                  Ir a Inventario →
                </Link>
              </div>
            )}
          </div>
        </>
      )}

      {/* Corridas anteriores: siempre al final, independiente del resultado actual */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Corridas anteriores
          </h3>
          {historial.length > HISTORIAL_LIMITE && (
            <button
              type="button"
              onClick={() => setVerTodoHistorial((v) => !v)}
              className="text-xs font-medium text-brand-500 hover:text-brand-600"
            >
              {verTodoHistorial ? "Ver menos" : `Ver todas (${historial.length})`}
            </button>
          )}
        </div>
        {cargandoHistorial ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : historial.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Todavía no se ha corrido el MRP en esta sucursal.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-100 dark:border-gray-800">
            {historialVisible.map((c, idx) => {
              const seleccionada = corridaSeleccionada === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => verCorrida(c.id)}
                  className={`flex w-full items-center justify-between gap-3 border-l-2 px-4 py-3 text-left transition-colors ${
                    idx > 0 ? "border-t border-t-gray-100 dark:border-t-gray-800" : ""
                  } ${
                    seleccionada
                      ? "border-l-brand-500 bg-brand-50 dark:bg-brand-500/10"
                      : "border-l-transparent hover:bg-gray-50 dark:hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Badge color="light" size="sm">
                      {c.horizonte_dias}d
                    </Badge>
                    <div>
                      <div className="text-sm font-medium text-gray-800 dark:text-white/90">
                        Corrida #{c.id}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <TimeIcon className="size-3" />
                        {new Date(c.creado_en).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>{c._count.necesidades} insumos</span>
                    <span>{c._count.ordenesGeneradas} OC</span>
                    <ChevronDownIcon className={`size-4 -rotate-90 ${seleccionada ? "text-brand-500" : ""}`} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
