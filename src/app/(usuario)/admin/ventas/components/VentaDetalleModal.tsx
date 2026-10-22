"use client";

import React, { useEffect, useState } from "react";
import {
  FileText,
  DollarSign,
  Layers,
  ShieldCheck,
  Receipt,
  User,
  Clock,
  Calendar,
  AlertCircle,
  Tag,
  CreditCard,
  Building2,
  TrendingUp,
  Percent,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import Badge from "@/components/ui/badge/Badge";

interface VentaDetalleModalProps {
  isOpen: boolean;
  onClose: () => void;
  pedidoId: string | null;
}

type TabKey = "fiscal" | "costeo" | "kardex" | "auditoria";

export default function VentaDetalleModal({
  isOpen,
  onClose,
  pedidoId,
}: VentaDetalleModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("fiscal");
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !pedidoId) {
      setData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetch(`/api/admin/ventas/${pedidoId}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Error ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((json) => {
        if (isMounted) {
          setData(json.data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Error al cargar los detalles de la venta");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, pedidoId]);

  const formatMoney = (val: number | string | null | undefined) => {
    const num = Number(val ?? 0);
    return `Bs ${num.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString("es-BO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })} ${d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
      return isoString;
    }
  };

  const pedido = data?.pedido;
  const factura = pedido?.factura;
  const costeo = data?.costeo;
  const kardex = data?.kardex || [];
  const auditoria = data?.auditoria;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-4xl p-6 sm:p-7 max-h-[90vh] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-800 pr-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400 flex items-center justify-center">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Detalle de Venta #{pedidoId}
              {pedido && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {pedido.estado}
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {pedido?.creado_en ? formatDate(pedido.creado_en) : "Cargando información..."}
            </p>
          </div>
        </div>

        {costeo && (
          <div className="text-right sm:pr-4">
            <span className="text-xs text-gray-400 uppercase font-semibold">Total Cobrado</span>
            <div className="text-xl font-extrabold text-gray-900 dark:text-white">
              {formatMoney(pedido?.total)}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 mt-3 -mx-2 px-2 overflow-x-auto text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("fiscal")}
          className={`flex items-center gap-2 py-2.5 px-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${
            activeTab === "fiscal"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          <FileText className="h-4 w-4" />
          Fiscal & General
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("costeo")}
          className={`flex items-center gap-2 py-2.5 px-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${
            activeTab === "costeo"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          <DollarSign className="h-4 w-4" />
          Items & Costeo Real/Teórico
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("kardex")}
          className={`flex items-center gap-2 py-2.5 px-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${
            activeTab === "kardex"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          <Layers className="h-4 w-4" />
          Kardex & Lotes ({kardex.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("auditoria")}
          className={`flex items-center gap-2 py-2.5 px-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${
            activeTab === "auditoria"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Auditoría & Eventos
        </button>
      </div>

      {/* Modal Content Body */}
      <div className="flex-1 overflow-y-auto py-4 pr-1">
        {isLoading ? (
          <div className="py-16 text-center text-gray-500 dark:text-gray-400">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand-500 border-r-transparent mb-3" />
            <p className="text-sm font-medium">Cargando desglose completo de la venta...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        ) : !data ? null : (
          <>
            {/* TAB 1: Fiscal & General */}
            {activeTab === "fiscal" && (
              <div className="space-y-5">
                {/* Factura Section */}
                <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-brand-500" />
                      Datos de Emisión Fiscal (Facturación)
                    </h3>
                    {factura ? (
                      <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                        Factura #{factura.id}
                      </span>
                    ) : (
                      <span className="text-xs italic text-gray-400">Sin Factura Registrada</span>
                    )}
                  </div>

                  {factura ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60">
                        <span className="text-gray-400 block mb-0.5">Razón Social</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-100">
                          {factura.razon_social || "S/N"}
                        </span>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60">
                        <span className="text-gray-400 block mb-0.5">NIT / CI</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-100 font-mono">
                          {factura.nit || "0"}
                        </span>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60">
                        <span className="text-gray-400 block mb-0.5">Método de Pago</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-100 uppercase">
                          {factura.metodo_pago}
                        </span>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60">
                        <span className="text-gray-400 block mb-0.5">Fecha Emisión</span>
                        <span className="font-medium text-gray-800 dark:text-gray-100">
                          {formatDate(factura.fecha_emision)}
                        </span>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60">
                        <span className="text-gray-400 block mb-0.5">Importe Total Facturado</span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {formatMoney(factura.importe_total)}
                        </span>
                      </div>
                      {factura.cuf && (
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 col-span-full">
                          <span className="text-gray-400 block mb-0.5">CUF Fiscal</span>
                          <span className="font-mono text-[11px] text-gray-600 dark:text-gray-300 break-all">
                            {factura.cuf}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Este pedido no cuenta con emisión fiscal asociada (comanda abierta o pendiente de facturación).
                    </p>
                  )}
                </div>

                {/* General Order Information */}
                <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-brand-500" />
                    Parámetros Operativos del Pedido
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400 block">Ubicación / Mesa</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {pedido.mesa || "Para Llevar / Mostrador"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Nombre del Cliente</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {pedido.cliente_nombre || "Cliente Final"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Turno de Caja</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {pedido.caja_id ? `Caja #${pedido.caja_id}` : "Sin turno asignado"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Total Comanda</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {formatMoney(pedido.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Items & Costeo */}
            {activeTab === "costeo" && (
              <div className="space-y-4">
                {/* Cost KPI Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="rounded-xl border border-gray-200 p-3 bg-white dark:border-gray-800 dark:bg-gray-800/40">
                    <span className="text-[11px] font-medium text-gray-400 uppercase">Venta Total</span>
                    <div className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                      {formatMoney(costeo.totalVenta)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-3 bg-white dark:border-gray-800 dark:bg-gray-800/40">
                    <span className="text-[11px] font-medium text-gray-400 uppercase">Costo Real (FEFO)</span>
                    <div className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                      {formatMoney(costeo.costoRealTotal)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-3 bg-white dark:border-gray-800 dark:bg-gray-800/40">
                    <span className="text-[11px] font-medium text-gray-400 uppercase">Margen Bruto</span>
                    <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {formatMoney(costeo.margenBruto)}{" "}
                      <span className="text-xs font-normal">({costeo.margenBrutoPct}%)</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-3 bg-white dark:border-gray-800 dark:bg-gray-800/40">
                    <span className="text-[11px] font-medium text-gray-400 uppercase">Brecha Real vs Teórico</span>
                    <div
                      className={`text-base font-bold mt-0.5 ${
                        costeo.brechaCosto > 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {costeo.brechaCosto > 0 ? `+${formatMoney(costeo.brechaCosto)}` : formatMoney(costeo.brechaCosto)}
                    </div>
                  </div>
                </div>

                {/* Items Detail Table */}
                <div className="rounded-xl border border-gray-200 overflow-hidden dark:border-gray-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-800/50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">
                        <th className="py-2.5 px-3">Producto / Extras</th>
                        <th className="py-2.5 px-2 text-center">Cant</th>
                        <th className="py-2.5 px-3 text-right">P. Unit</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                        <th className="py-2.5 px-3 text-right">Costo Real</th>
                        <th className="py-2.5 px-3 text-right">Costo Teórico</th>
                        <th className="py-2.5 px-3 text-right">Margen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                      {pedido.items?.map((item: any) => (
                        <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.01]">
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-gray-800 dark:text-gray-200">
                              {item.producto?.nombre || `Producto #${item.producto_id}`}
                            </span>
                            {item.extras && item.extras.length > 0 && (
                              <div className="text-[10px] text-gray-400 mt-0.5 space-y-0.5">
                                {item.extras.map((extra: any) => (
                                  <div key={extra.id}>
                                    + {extra.nombre} ({formatMoney(extra.precio)})
                                  </div>
                                ))}
                              </div>
                            )}
                            {item.notas && (
                              <div className="text-[10px] italic text-amber-600 dark:text-amber-400">
                                Nota: {item.notas}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center font-medium">{item.cantidad}</td>
                          <td className="py-2.5 px-3 text-right">{formatMoney(item.precio_unit)}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-gray-800 dark:text-gray-100">
                            {formatMoney(item.subtotal)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400 font-medium">
                            {formatMoney(item.costo_real)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-500 dark:text-gray-400">
                            {formatMoney(item.costo_teorico)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                            {formatMoney(item.margen_bs)}{" "}
                            <span className="text-[10px] text-gray-400">({item.margen_pct}%)</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: Kardex & Lotes */}
            {activeTab === "kardex" && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Trazabilidad de consumos FEFO y movimientos de inventario vinculados a la comanda #{pedidoId}:
                </p>

                {kardex.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                    No se encontraron registros de movimiento de inventario en el Kardex para esta venta.
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 overflow-hidden dark:border-gray-800">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-800/50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">
                          <th className="py-2.5 px-3">Fecha</th>
                          <th className="py-2.5 px-3">Tipo / Motivo</th>
                          <th className="py-2.5 px-3">Insumo / Ítem</th>
                          <th className="py-2.5 px-3">Lote Caducidad</th>
                          <th className="py-2.5 px-3 text-right">Cantidad</th>
                          <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                          <th className="py-2.5 px-3 text-right">Referencia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                        {kardex.map((mov: any) => (
                          <tr key={mov.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.01]">
                            <td className="py-2 px-3 text-gray-500">{formatDate(mov.creado_en)}</td>
                            <td className="py-2 px-3">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  mov.tipo === "Salida"
                                    ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                                    : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                                }`}
                              >
                                {mov.tipo} / {mov.motivo}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-medium text-gray-800 dark:text-gray-200">
                              {mov.item?.nombre || `Ítem #${mov.item_id}`}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-gray-600 dark:text-gray-300">
                              {mov.lote ? (
                                <span>
                                  {mov.lote.codigo_lote}{" "}
                                  <span className="text-gray-400 text-[10px]">
                                    ({mov.lote.fecha_caducidad ? formatDate(mov.lote.fecha_caducidad).split(" ")[0] : "S/F"})
                                  </span>
                                </span>
                              ) : (
                                <span className="text-gray-400">Sin Lote</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold">
                              {Number(mov.cantidad).toLocaleString("es-BO")} {mov.item?.unidad_code || ""}
                            </td>
                            <td className="py-2 px-3 text-right">{formatMoney(mov.costo_unit)}</td>
                            <td className="py-2 px-3 text-right text-[11px] text-gray-400 truncate max-w-[130px]">
                              {mov.referencia}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Auditoría */}
            {activeTab === "auditoria" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-4 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-800/40 space-y-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <User className="h-4 w-4 text-brand-500" /> Personal Interviniente
                    </span>
                    <div className="space-y-1 text-gray-600 dark:text-gray-300">
                      <div>
                        <span className="text-gray-400">Mesero que comandó:</span>{" "}
                        <span className="font-medium text-gray-800 dark:text-gray-100">
                          {auditoria?.mesero?.nombre || "No especificado"} (ID #{auditoria?.mesero?.id})
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Cajero que cobró:</span>{" "}
                        <span className="font-medium text-gray-800 dark:text-gray-100">
                          {auditoria?.cajero?.nombre || "No especificado"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Turno de Caja:</span>{" "}
                        <span className="font-medium text-gray-800 dark:text-gray-100">
                          #{auditoria?.caja_id || "N/A"} ({auditoria?.caja_estado || "desconocido"})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-800/40 space-y-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-brand-500" /> Marcas de Tiempo
                    </span>
                    <div className="space-y-1 text-gray-600 dark:text-gray-300">
                      <div>
                        <span className="text-gray-400">Fecha de Creación:</span>{" "}
                        <span className="font-medium text-gray-800 dark:text-gray-100">
                          {formatDate(auditoria?.creado_en)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Última Actualización:</span>{" "}
                        <span className="font-medium text-gray-800 dark:text-gray-100">
                          {formatDate(auditoria?.actualizado_en)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Eventos y Observaciones */}
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/30">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Bitácora de Observaciones y Registro de Anulación:
                  </span>
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700/60 font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {auditoria?.observaciones || "Sin observaciones ni eventos registrados."}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
