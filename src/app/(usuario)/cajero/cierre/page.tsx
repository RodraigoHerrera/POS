"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import ConteoDenominaciones from "@/components/caja/ConteoDenominaciones";
import TopBarCajero from "@/components/caja/TopBarCajero";
import TicketCierreCaja from "@/components/caja/TicketCierreCaja";
import type { CierreCajaData } from "@/lib/ticketCierre";
import Button from "@/components/ui/button/Button";
import {
  conciliacionEnVivo,
  parsearMontoDeclarado,
  totalConteo,
  type EstadoConciliacion,
  type FilaConciliacion,
} from "@/lib/conteoCierre";

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

// Respuesta de POST /api/caja/cerrar (incluye lo necesario para el ticket).
type ResultadoCierre = CierreCajaData;

const bs = (n: number) => `Bs ${n.toFixed(2)}`;
const bsConSigno = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}Bs ${Math.abs(n).toFixed(2)}`;

const CHIP_ESTADO: Record<EstadoConciliacion, string> = {
  Exacta: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  Sobrante: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  Faltante: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  Pendiente: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const INPUT_MONTO =
  "w-full rounded-xl border-2 border-gray-200 py-3 pl-12 pr-4 text-lg font-bold tabular-nums focus:border-red-500 focus:ring-0 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white";

const BOTON_CONFIRMAR =
  "w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-4 text-lg font-bold text-white shadow-lg shadow-red-500/30 hover:bg-red-700 active:scale-[0.98] disabled:opacity-70";

function TituloSeccion({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-gray-800 dark:text-white">
      <span className="block h-6 w-1 rounded-full bg-brand-500" />
      {children}
    </h2>
  );
}

function Chip({ estado }: { estado: EstadoConciliacion }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CHIP_ESTADO[estado]}`}>
      {estado}
    </span>
  );
}

// Texto corto para la barra inferior móvil: primer método con diferencia, o el estado general.
function estadoGeneral(filas: FilaConciliacion[]): string {
  const conDiferencia = filas.find((f) => f.estado === "Faltante" || f.estado === "Sobrante");
  if (conDiferencia && conDiferencia.diferencia !== null) {
    return `${conDiferencia.metodo}: ${conDiferencia.estado} ${bs(Math.abs(conDiferencia.diferencia))}`;
  }
  if (filas.some((f) => f.estado === "Pendiente")) return "Faltan montos por declarar";
  return "Todo cuadra";
}

export default function CierreCajaPage() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [sinCajaAbierta, setSinCajaAbierta] = useState(false);
  const [resumen, setResumen] = useState<ResumenCaja | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState("");
  const [totalTarjeta, setTotalTarjeta] = useState("");
  const [totalQr, setTotalQr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCierre | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSalir = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout?scope=empleado", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Error cerrando sesión de empleado tras cierre:", error);
    } finally {
      window.location.replace("/usuarios");
    }
  };

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

  const totalContado = useMemo(() => totalConteo(counts), [counts]);

  const filas = useMemo(
    () =>
      resumen
        ? conciliacionEnVivo({
            efectivoEsperado: resumen.efectivoEsperado,
            efectivoContado: totalContado,
            tarjetaEsperado: resumen.ventasPorMetodo.ventas_tarjeta,
            tarjetaDeclarado: totalTarjeta,
            qrEsperado: resumen.ventasPorMetodo.ventas_qr,
            qrDeclarado: totalQr,
          })
        : [],
    [resumen, totalContado, totalTarjeta, totalQr]
  );

  const cerrarCaja = async () => {
    // Fail-fast en cliente: no se envía nada si los totales electrónicos son inválidos.
    const tarjeta = parsearMontoDeclarado(totalTarjeta, "Total Tarjeta");
    const qr = parsearMontoDeclarado(totalQr, "Total QR");
    if ("error" in tarjeta) {
      setError(tarjeta.error);
      return;
    }
    if ("error" in qr) {
      setError(qr.error);
      return;
    }
    setError(null);

    try {
      setIsSaving(true);
      const res = await fetch("/api/caja/cerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalContado,
          totalTarjeta: tarjeta.valor,
          totalQr: qr.valor,
          observaciones: observaciones || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "No se pudo cerrar la caja");
      setResultado(data);
    } catch (e) {
      console.error("Error cerrando caja:", e);
      setError(e instanceof Error ? e.message : "Ocurrió un error al cerrar la caja");
    } finally {
      setIsSaving(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 bg-gray-50 text-gray-400 dark:bg-gray-900">
        <Loader2 className="animate-spin" size={20} />
        Cargando resumen de caja...
      </div>
    );
  }

  if (sinCajaAbierta) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center dark:bg-gray-900">
        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="mb-5 text-lg font-medium text-gray-700 dark:text-gray-200">
            No tienes una caja abierta en esta sucursal.
          </p>
          <Button onClick={() => router.push("/cajero/ventas")}>Ir a Ventas</Button>
        </div>
      </div>
    );
  }

  if (resultado) {
    return <TicketCierreCaja cierre={resultado} onSalir={handleSalir} saliendo={isLoggingOut} />;
  }

  const hayPendientes = filas.some((f) => f.estado === "Pendiente");
  const totalEsperado = filas.reduce((s, f) => s + f.esperado, 0);
  const totalDeclarado = filas.reduce((s, f) => s + (f.declarado ?? 0), 0);
  const totalDiferencia = Math.round((totalDeclarado - totalEsperado) * 100) / 100;

  const contenidoBoton = isSaving ? (
    <>
      <Loader2 className="animate-spin" size={20} />
      Cerrando...
    </>
  ) : (
    "Confirmar Cierre"
  );

  return (
    <div className="flex h-screen w-full flex-col bg-gray-50 dark:bg-gray-900">
      <TopBarCajero
        variant="simple"
        titulo="Cierre de Caja"
        empleadoNombre={resumen?.empleadoNombre ?? ""}
        turnoInicio={resumen?.fechaApertura}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-4 pb-32 sm:p-6 sm:pb-32 lg:pb-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Cierre de Caja</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Cuenta el efectivo, declara los cobros electrónicos y revisa el resumen antes de
              confirmar.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <TituloSeccion>① Efectivo en caja</TituloSeccion>
                <ConteoDenominaciones
                  counts={counts}
                  onChange={(denom, valor) => setCounts((prev) => ({ ...prev, [denom]: valor }))}
                />
                <div className="mt-5 flex items-center justify-between rounded-xl border border-green-100 bg-green-50 p-4 dark:border-green-800/30 dark:bg-green-900/20">
                  <span className="text-sm font-semibold uppercase tracking-wider text-green-700 dark:text-green-400">
                    Total contado
                  </span>
                  <span className="text-3xl font-bold tabular-nums text-green-700 dark:text-green-400">
                    {bs(totalContado)}
                  </span>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <TituloSeccion>② Cobros electrónicos</TituloSeccion>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="total-tarjeta"
                      className="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-300"
                    >
                      Total Tarjeta (lote POS / vouchers)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">
                        Bs
                      </span>
                      <input
                        id="total-tarjeta"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0.00"
                        value={totalTarjeta}
                        onChange={(e) => setTotalTarjeta(e.target.value)}
                        className={INPUT_MONTO}
                      />
                    </div>
                    {resumen && (
                      <p className="mt-1 text-xs text-gray-400">
                        Sistema: {bs(resumen.ventasPorMetodo.ventas_tarjeta)}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="total-qr"
                      className="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-300"
                    >
                      Total QR (comprobantes)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">
                        Bs
                      </span>
                      <input
                        id="total-qr"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0.00"
                        value={totalQr}
                        onChange={(e) => setTotalQr(e.target.value)}
                        className={INPUT_MONTO}
                      />
                    </div>
                    {resumen && (
                      <p className="mt-1 text-xs text-gray-400">
                        Sistema: {bs(resumen.ventasPorMetodo.ventas_qr)}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <TituloSeccion>③ Observaciones</TituloSeccion>
                <label htmlFor="observaciones" className="sr-only">
                  Observaciones
                </label>
                <textarea
                  id="observaciones"
                  rows={3}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Opcional. Explica cualquier sobrante o faltante."
                  className="w-full rounded-xl border-2 border-gray-200 p-3 focus:border-red-500 focus:ring-0 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </section>
            </div>

            <aside className="self-start lg:sticky lg:top-6 lg:col-span-5">
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <TituloSeccion>Resumen del cierre</TituloSeccion>

                <div className="divide-y divide-dashed divide-gray-200 dark:divide-gray-700">
                  {filas.map((f) => (
                    <div key={f.metodo} className="py-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-bold text-gray-800 dark:text-white">{f.metodo}</span>
                        <Chip estado={f.estado} />
                      </div>
                      <dl className="space-y-0.5 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex justify-between">
                          <dt>Esperado</dt>
                          <dd className="font-mono tabular-nums">{bs(f.esperado)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>Declarado</dt>
                          <dd className="font-mono tabular-nums">
                            {f.declarado === null ? "—" : bs(f.declarado)}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>Diferencia</dt>
                          <dd className="font-mono tabular-nums">
                            {f.diferencia === null ? "—" : bsConSigno(f.diferencia)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>

                <div className="mt-1 space-y-0.5 border-t-2 border-dashed border-gray-200 pt-3 text-sm dark:border-gray-700">
                  <div className="flex justify-between text-gray-500 dark:text-gray-400">
                    <span>Total esperado</span>
                    <span className="font-mono tabular-nums">{bs(totalEsperado)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-800 dark:text-white">
                    <span>Total declarado</span>
                    <span className="font-mono tabular-nums">{bs(totalDeclarado)}</span>
                  </div>
                  {!hayPendientes && (
                    <div className="flex justify-between text-gray-500 dark:text-gray-400">
                      <span>Diferencia total</span>
                      <span className="font-mono tabular-nums">{bsConSigno(totalDiferencia)}</span>
                    </div>
                  )}
                </div>

                {error && (
                  <p
                    role="alert"
                    className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 animate-in fade-in dark:bg-red-900/20 dark:text-red-400"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={cerrarCaja}
                  disabled={isSaving}
                  className={`mt-5 hidden lg:flex ${BOTON_CONFIRMAR}`}
                >
                  {contenidoBoton}
                </button>
                <Link
                  href="/cajero/ventas"
                  className="mt-3 hidden text-center text-sm text-gray-500 hover:text-gray-700 hover:underline lg:block dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Cancelar
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Barra inferior móvil: estado general + confirmar (en lg+ lo cubre el resumen lateral). */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white p-3 shadow-lg lg:hidden dark:border-gray-800 dark:bg-gray-900">
        {/* El error se repite aquí: en móvil el resumen queda fuera de la vista. */}
        {error ? (
          <p role="alert" className="mb-2 text-center text-sm font-semibold text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : (
          <p className="mb-2 text-center text-sm font-semibold text-gray-600 dark:text-gray-300">
            {estadoGeneral(filas)}
          </p>
        )}
        <button
          type="button"
          onClick={cerrarCaja}
          disabled={isSaving}
          className={`flex ${BOTON_CONFIRMAR}`}
        >
          {contenidoBoton}
        </button>
      </div>
    </div>
  );
}
