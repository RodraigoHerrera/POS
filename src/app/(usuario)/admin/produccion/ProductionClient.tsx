"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { executeProductionBatch } from "@/app/actions/produccion";
import type { RecetaProduccionVista } from "@/lib/produccion";
import { labelUnidad } from "@/lib/unidad";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import {
  AlertIcon,
  BoltIcon,
  BoxCubeIcon,
  CalenderIcon,
  CheckCircleIcon,
  DollarLineIcon,
  TaskIcon,
} from "@/icons";

export interface ProduccionReciente {
  id: string;
  fecha: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  codigoLote: string;
  costoUnit: number;
  caducidad: string | null;
}

type Props = {
  recetas: RecetaProduccionVista[];
  recientes: ProduccionReciente[];
  sucursalNombre: string;
};

// Same tolerance the FEFO deduction uses to ignore rounding residue.
const EPSILON = 0.0001;

const formatCantidad = (n: number) =>
  n.toLocaleString("es-BO", { maximumFractionDigits: 3 });

const formatFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });

const thClass =
  "px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400";

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
        <p className="truncate text-lg font-semibold text-gray-800 dark:text-white/90 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

export default function ProductionClient({ recetas, recientes, sucursalNombre }: Props) {
  const router = useRouter();
  const [recipeId, setRecipeId] = useState<string>("");
  const [cantidadTexto, setCantidadTexto] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const receta = recetas.find((r) => r.id === recipeId) ?? null;
  const cantidad = Number(cantidadTexto);
  const cantidadValida = cantidadTexto.trim() !== "" && Number.isFinite(cantidad) && cantidad > 0;

  const plan = useMemo(() => {
    if (!receta || receta.error) return null;
    const qty = cantidadValida ? cantidad : 0;
    const filas = receta.insumos.map((i) => {
      const requerido = i.porUnidad * qty;
      return { ...i, requerido, falta: requerido - i.disponible > EPSILON };
    });
    const costoTotal = filas.reduce((acc, f) => acc + f.requerido * f.costoUnit, 0);
    const maximo = Math.min(
      ...receta.insumos.map((i) => (i.porUnidad > 0 ? i.disponible / i.porUnidad : Infinity))
    );
    return {
      filas,
      costoTotal,
      costoUnit: qty > 0 ? costoTotal / qty : 0,
      maximo: Number.isFinite(maximo) ? Math.floor(maximo * 1000) / 1000 : 0,
      faltantes: filas.filter((f) => f.falta).length,
    };
  }, [receta, cantidad, cantidadValida]);

  const vencimiento = useMemo(() => {
    if (!receta?.vidaUtilDias) return null;
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + receta.vidaUtilDias);
    return fecha.toISOString();
  }, [receta]);

  const puedeProducir =
    !!receta && !receta.error && cantidadValida && !!plan && plan.faltantes === 0 && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeProducir) return;

    setLoading(true);
    setMessage(null);
    try {
      const result = await executeProductionBatch({ recipeId, quantity: cantidad });
      if (result.success) {
        setMessage({
          text: `${result.message} ${formatCantidad(cantidad)} ${labelUnidad(receta?.unidad)} de ${receta?.nombre}.`,
          type: "success",
        });
        setCantidadTexto("");
        router.refresh();
      } else {
        setMessage({ text: result.message, type: "error" });
      }
    } catch (error) {
      const text = error instanceof Error && error.message ? error.message : "Error al procesar la producción.";
      setMessage({ text, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  if (recetas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-800 dark:bg-white/3">
        <div className="flex size-12 items-center justify-center rounded-full bg-gray-50 text-gray-400 dark:bg-white/5 dark:text-gray-500">
          <BoxCubeIcon className="size-6" />
        </div>
        <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
          No hay preparaciones con receta. Crea un item de tipo Preparación y define su receta para producirlo por lote.
        </p>
        <Link href="/admin/recetas" className="text-sm font-medium text-brand-500 hover:text-brand-600">
          Ir a recetas
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Formulario + insumos */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-5 py-3 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Nueva producción</h3>
            <Badge color="light" size="sm">
              Sucursal: {sucursalNombre || "actual"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label htmlFor="receta">Preparación</Label>
              <Select
                value={recipeId}
                onChange={(v) => {
                  setRecipeId(v);
                  setMessage(null);
                }}
                placeholder="Seleccione una preparación"
                options={recetas.map((r) => ({ value: r.id, label: r.nombre }))}
              />
            </div>
            <div>
              <Label htmlFor="cantidad">
                Cantidad{receta ? ` (${labelUnidad(receta.unidad)})` : ""}
              </Label>
              <Input
                id="cantidad"
                type="number"
                value={cantidadTexto}
                onChange={(e) => setCantidadTexto(e.target.value)}
                disabled={loading || !receta}
                min="0"
                step="any"
                placeholder="Ej. 10"
                error={cantidadTexto !== "" && !cantidadValida}
                hint={
                  plan && !receta?.error
                    ? `Máximo con el stock actual: ${formatCantidad(plan.maximo)}`
                    : undefined
                }
              />
            </div>
          </div>

          {receta?.error && (
            <div className="mx-5 mb-5 flex items-center gap-2 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
              <AlertIcon className="size-4 shrink-0" />
              <span>
                {receta.error}.{" "}
                <Link href="/admin/recetas" className="font-medium underline">
                  Corregir receta
                </Link>
              </span>
            </div>
          )}

          {plan && (
            <div className="overflow-x-auto border-t border-gray-200 dark:border-gray-800">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className={`${thClass} text-left`}>Insumo</th>
                    <th className={`${thClass} text-right`}>Requerido</th>
                    <th className={`${thClass} text-right`}>Disponible</th>
                    <th className={`${thClass} text-right`}>Costo est.</th>
                    <th className={`${thClass} text-left`}>Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {plan.filas.map((f) => (
                    <tr key={f.itemId} className="hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-white">{f.nombre}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-gray-800 dark:text-white">
                        {formatCantidad(f.requerido)} <span className="font-normal text-gray-400">{labelUnidad(f.unidad)}</span>
                      </td>
                      <td
                        className={`px-4 py-3 text-right text-sm tabular-nums ${
                          f.falta ? "text-error-600 dark:text-error-400" : "text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {formatCantidad(f.disponible)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-600 dark:text-gray-300">
                        Bs {(f.requerido * f.costoUnit).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {!cantidadValida ? (
                          <span className="text-gray-400">—</span>
                        ) : f.falta ? (
                          <Badge color="error" size="sm">
                            Falta {formatCantidad(f.requerido - f.disponible)}
                          </Badge>
                        ) : (
                          <Badge color="success" size="sm">Suficiente</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {!receta
                ? "Seleccione una preparación para ver los insumos."
                : plan && plan.faltantes > 0 && cantidadValida
                  ? `Faltan ${plan.faltantes} insumo(s) para esta cantidad.`
                  : "Los insumos se descuentan por FEFO: primero los lotes que vencen antes."}
            </p>
            <Button type="submit" size="sm" variant="primary" startIcon={<BoltIcon />} disabled={!puedeProducir}>
              {loading ? "Procesando..." : "Ejecutar producción"}
            </Button>
          </div>
        </form>

        {/* Resumen */}
        <div className="space-y-3">
          <StatCard
            icon={<DollarLineIcon className="size-5" />}
            label="Costo estimado del lote"
            value={plan && cantidadValida ? `Bs ${plan.costoTotal.toFixed(2)}` : "—"}
          />
          <StatCard
            icon={<TaskIcon className="size-5" />}
            label={`Costo por ${receta ? labelUnidad(receta.unidad) : "unidad"}`}
            value={plan && cantidadValida ? `Bs ${plan.costoUnit.toFixed(2)}` : "—"}
          />
          <StatCard
            icon={<BoxCubeIcon className="size-5" />}
            label="Máximo producible"
            value={plan ? `${formatCantidad(plan.maximo)} ${labelUnidad(receta?.unidad)}` : "—"}
            tone={plan ? (plan.maximo > 0 ? "success" : "warning") : "default"}
          />
          <StatCard
            icon={<CalenderIcon className="size-5" />}
            label="Vence el lote"
            value={receta ? (vencimiento ? formatFecha(vencimiento) : "Sin vencimiento") : "—"}
          />
          <p className="px-1 text-xs text-gray-400 dark:text-gray-500">
            El costo es estimado con el costo promedio; el real se calcula con los lotes consumidos.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400"
              : "border-error-200 bg-error-50 text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircleIcon className="size-4 shrink-0" />
          ) : (
            <AlertIcon className="size-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Historial */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="border-b border-gray-200 px-5 py-3 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Producciones recientes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className={`${thClass} text-left`}>Fecha</th>
                <th className={`${thClass} text-left`}>Preparación</th>
                <th className={`${thClass} text-right`}>Cantidad</th>
                <th className={`${thClass} text-right`}>Costo unit.</th>
                <th className={`${thClass} text-left`}>Lote</th>
                <th className={`${thClass} text-left`}>Vence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {recientes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    Todavía no hay producciones en esta sucursal.
                  </td>
                </tr>
              ) : (
                recientes.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatFecha(p.fecha)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-white">{p.nombre}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-gray-800 dark:text-white">
                      {formatCantidad(p.cantidad)} <span className="font-normal text-gray-400">{labelUnidad(p.unidad)}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-600 dark:text-gray-300">
                      Bs {p.costoUnit.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{p.codigoLote}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {p.caducidad ? formatFecha(p.caducidad) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
