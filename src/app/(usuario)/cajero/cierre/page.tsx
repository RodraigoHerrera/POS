"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import DenominacionesForm, { DetalleDenominacion } from "@/components/caja/DenominacionesForm";
import TopBarCajero from "@/components/caja/TopBarCajero";
import Button from "@/components/ui/button/Button";

interface ResumenCaja {
  empleadoNombre: string;
  saldoInicial: number;
  fechaApertura: string;
  ventasPorMetodo: {
    ventas_efectivo: number;
    ventas_tarjeta: number;
    ventas_qr: number;
    ventas_transfer: number;
    ventas_giftcard: number;
    ventas_otros: number;
  };
  totalVentas: number;
  efectivoEsperado: number;
}

interface ResultadoCierre {
  totalVentas: number;
  efectivoEsperado: number;
  totalContado: number;
  diferenciaEfectivo: number;
}

const LABEL_METODO: Record<string, string> = {
  ventas_efectivo: "Efectivo",
  ventas_tarjeta: "Tarjeta",
  ventas_qr: "QR",
  ventas_transfer: "Transferencia",
  ventas_giftcard: "Gift Card",
  ventas_otros: "Otros",
};

export default function CierreCajaPage() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [sinCajaAbierta, setSinCajaAbierta] = useState(false);
  const [resumen, setResumen] = useState<ResumenCaja | null>(null);
  const [observaciones, setObservaciones] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCierre | null>(null);
  // El resumen del sistema es material de referencia, no la tarea en sí
  // (contar el efectivo físico) — colapsado por defecto para no competir
  // por atención con la grilla de conteo.
  const [mostrarDetalle, setMostrarDetalle] = useState(false);

  useEffect(() => {
    const cargarResumen = async () => {
      try {
        const res = await fetch("/api/caja/resumen");
        if (res.status === 404) {
          setSinCajaAbierta(true);
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Error al cargar el resumen");
        setResumen(data);
      } catch (error) {
        console.error("Error cargando resumen de caja:", error);
        setSinCajaAbierta(true);
      } finally {
        setCargando(false);
      }
    };
    cargarResumen();
  }, []);

  const cerrarCaja = async (total: number, _detalle: DetalleDenominacion[]) => {
    try {
      setIsSaving(true);
      const res = await fetch("/api/caja/cerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalContado: total, observaciones: observaciones || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "No se pudo cerrar la caja");
      setResultado(data);
    } catch (error: any) {
      console.error("Error cerrando caja:", error);
      alert(error.message || "Ocurrió un error al cerrar la caja");
    } finally {
      setIsSaving(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">
        Cargando resumen de caja...
      </div>
    );
  }

  if (sinCajaAbierta) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
          No tienes una caja abierta en esta sucursal.
        </p>
        <Button onClick={() => router.push("/cajero/ventas")}>Ir a Ventas</Button>
      </div>
    );
  }

  if (resultado) {
    const diferencia = resultado.diferenciaEfectivo;
    const esExacto = Math.abs(diferencia) < 0.01;
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-2 text-2xl font-bold text-gray-800 dark:text-white/90">Caja cerrada</h2>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Total ventas del turno: Bs {resultado.totalVentas.toFixed(2)}
          </p>

          <div
            className={`rounded-xl border p-6 ${
              esExacto
                ? "border-success-200 bg-success-50 dark:border-success-500/30 dark:bg-success-500/10"
                : "border-warning-200 bg-warning-50 dark:border-warning-500/30 dark:bg-warning-500/10"
            }`}
          >
            <p className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {esExacto ? "Caja exacta" : diferencia > 0 ? "Sobrante" : "Faltante"}
            </p>
            <p
              className={`text-3xl font-bold tabular-nums ${
                esExacto
                  ? "text-success-600 dark:text-success-400"
                  : "text-warning-600 dark:text-warning-400"
              }`}
            >
              Bs {Math.abs(diferencia).toFixed(2)}
            </p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Esperado: Bs {resultado.efectivoEsperado.toFixed(2)} · Contado: Bs{" "}
              {resultado.totalContado.toFixed(2)}
            </p>
          </div>

          <Button className="mt-6 w-full" onClick={() => router.push("/usuarios")}>
            Salir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-gray-50 dark:bg-gray-900">
      <TopBarCajero
        variant="simple"
        titulo="Cierre de Caja"
        empleadoNombre={resumen?.empleadoNombre ?? ""}
        turnoInicio={resumen?.fechaApertura}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">
          <DenominacionesForm
            title="Cierre de Caja"
            subtitle="Cuenta el efectivo físico del cajón y confirma el cierre."
            submitLabel="Confirmar Cierre"
            savingLabel="Cerrando..."
            isSaving={isSaving}
            onSubmit={cerrarCaja}
            onCancel={() => router.push("/cajero/ventas")}
            topSlot={
              resumen && (
                <div className="my-6 rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/3">
                  <button
                    onClick={() => setMostrarDetalle((v) => !v)}
                    className="flex w-full items-center justify-between p-5 text-left"
                    aria-expanded={mostrarDetalle}
                  >
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Efectivo esperado:{" "}
                      <span className="text-gray-900 dark:text-white">
                        Bs {resumen.efectivoEsperado.toFixed(2)}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {mostrarDetalle ? "Ocultar detalle" : "Ver detalle"}
                      {mostrarDetalle ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </button>

                  {mostrarDetalle && (
                    <div className="border-t border-gray-200 px-5 pb-5 pt-4 dark:border-gray-700">
                      <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Resumen del sistema (antes de contar)
                      </h5>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {Object.entries(resumen.ventasPorMetodo).map(([key, valor]) => (
                          <div key={key} className="rounded-lg bg-white px-3 py-2 dark:bg-gray-900">
                            <p className="text-xs text-gray-400">{LABEL_METODO[key]}</p>
                            <p className="text-sm font-semibold tabular-nums text-gray-800 dark:text-white">
                              Bs {valor.toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                        Saldo inicial Bs {resumen.saldoInicial.toFixed(2)} + ventas efectivo Bs{" "}
                        {resumen.ventasPorMetodo.ventas_efectivo.toFixed(2)}
                      </p>
                    </div>
                  )}

                  <div className="px-5 pb-5">
                    <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                      Observaciones (opcional, ej. si hay sobrante/faltante)
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      rows={2}
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                    />
                  </div>
                </div>
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
