"use client";

import React from "react";
import {
  Eye,
  Ban,
  Receipt,
  CreditCard,
  Banknote,
  QrCode,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  AlertTriangle,
} from "lucide-react";
import Badge from "@/components/ui/badge/Badge";

export interface PedidoItemSimple {
  id: string;
  producto_id: string;
  cantidad: number;
  precio_unit: number | string;
  subtotal: number | string;
  costo_real?: number | string | null;
  costo_teorico?: number | string | null;
  producto?: {
    id: string;
    nombre: string;
    categoria?: string | null;
  };
}

export interface FacturaSimple {
  id: string;
  razon_social: string;
  nit: string;
  importe_total: number | string;
  metodo_pago: string;
  fecha_emision: string;
  cuf?: string | null;
  url_sin?: string | null;
}

export interface PedidoSaleRecord {
  id: string;
  sucursal_id: string;
  empleado_id: string;
  caja_id: string | null;
  mesa: string | null;
  cliente_nombre: string | null;
  estado: string;
  total: number | string;
  observaciones: string | null;
  creado_en: string;
  actualizado_en: string;
  factura?: FacturaSimple | null;
  empleado?: {
    id: string;
    nombre: string;
  } | null;
  items?: PedidoItemSimple[];
}

interface VentasTableProps {
  pedidos: PedidoSaleRecord[];
  isLoading: boolean;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onViewDetail: (pedidoId: string) => void;
  onAnular: (pedido: PedidoSaleRecord) => void;
}

export default function VentasTable({
  pedidos,
  isLoading,
  pagination,
  onPageChange,
  onViewDetail,
  onAnular,
}: VentasTableProps) {
  const formatMoney = (val: number | string | null | undefined) => {
    const num = Number(val ?? 0);
    return `Bs ${num.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return {
        date: d.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" }),
        time: d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" }),
      };
    } catch {
      return { date: isoString, time: "" };
    }
  };

  const getMetodoBadge = (metodo?: string | null) => {
    const m = (metodo || "").toLowerCase();
    if (m === "cash" || m === "efectivo") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
          <Banknote className="h-3 w-3" /> Efectivo
        </span>
      );
    }
    if (m === "card" || m === "tarjeta") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
          <CreditCard className="h-3 w-3" /> Tarjeta
        </span>
      );
    }
    if (m === "qr") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-500/10 dark:text-purple-400">
          <QrCode className="h-3 w-3" /> QR
        </span>
      );
    }
    if (m === "transfer") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400">
          Transfer
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        {metodo || "Sin cobro"}
      </span>
    );
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "PAGADO":
        return (
          <Badge variant="light" color="success" size="sm">
            PAGADO
          </Badge>
        );
      case "ANULADO":
        return (
          <Badge variant="light" color="error" size="sm">
            ANULADO
          </Badge>
        );
      case "ENTREGADO":
      case "PREPARADO":
        return (
          <Badge variant="light" color="info" size="sm">
            {estado}
          </Badge>
        );
      case "PENDIENTE":
      case "COMANDADO":
        return (
          <Badge variant="light" color="warning" size="sm">
            {estado}
          </Badge>
        );
      default:
        return (
          <Badge variant="light" color="light" size="sm">
            {estado}
          </Badge>
        );
    }
  };

  const startRecord = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endRecord = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900/40 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/75 dark:border-gray-800 dark:bg-gray-800/40 text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">
              <th className="py-3.5 px-4">Pedido / Factura</th>
              <th className="py-3.5 px-4">Fecha y Hora</th>
              <th className="py-3.5 px-4">Cliente / Razón Social</th>
              <th className="py-3.5 px-4">Atendido por</th>
              <th className="py-3.5 px-4">Método</th>
              <th className="py-3.5 px-4 text-right">Total</th>
              <th className="py-3.5 px-4 text-center">Estado</th>
              <th className="py-3.5 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {isLoading ? (
              // Loading skeletons
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-4 px-4">
                    <div className="h-4 w-20 bg-gray-200 rounded dark:bg-gray-700 mb-1"></div>
                    <div className="h-3 w-14 bg-gray-100 rounded dark:bg-gray-800"></div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="h-4 w-24 bg-gray-200 rounded dark:bg-gray-700 mb-1"></div>
                    <div className="h-3 w-16 bg-gray-100 rounded dark:bg-gray-800"></div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="h-4 w-32 bg-gray-200 rounded dark:bg-gray-700 mb-1"></div>
                    <div className="h-3 w-20 bg-gray-100 rounded dark:bg-gray-800"></div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="h-4 w-24 bg-gray-200 rounded dark:bg-gray-700"></div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="h-5 w-16 bg-gray-200 rounded dark:bg-gray-700"></div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="h-4 w-16 bg-gray-200 rounded dark:bg-gray-700 ml-auto"></div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="h-5 w-16 bg-gray-200 rounded-full dark:bg-gray-700 mx-auto"></div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="h-8 w-16 bg-gray-200 rounded dark:bg-gray-700 ml-auto"></div>
                  </td>
                </tr>
              ))
            ) : pedidos.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={8} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-gray-500 dark:text-gray-400">
                    <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 text-gray-400">
                      <Receipt className="h-6 w-6" />
                    </div>
                    <p className="text-base font-medium text-gray-800 dark:text-gray-200">
                      No se encontraron pedidos
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      No hay registros de ventas que coincidan con los filtros y fechas seleccionadas.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              // Table Rows
              pedidos.map((pedido) => {
                const { date, time } = formatDate(pedido.creado_en);
                const isAnulado = pedido.estado === "ANULADO";

                return (
                  <tr
                    key={pedido.id}
                    className="hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {/* ID Pedido / Factura */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800 dark:text-gray-200 font-mono">
                          #{pedido.id}
                        </span>
                        {pedido.mesa && (
                          <span className="text-[11px] font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 px-1.5 py-0.5 rounded">
                            {pedido.mesa}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                        <Receipt className="h-3 w-3" />
                        {pedido.factura ? (
                          <span className="font-mono text-brand-600 dark:text-brand-400 font-medium">
                            Fac #{pedido.factura.id}
                          </span>
                        ) : (
                          <span className="italic text-gray-400">Sin Factura</span>
                        )}
                      </div>
                    </td>

                    {/* Fecha y Hora */}
                    <td className="py-3.5 px-4 text-xs">
                      <div className="text-gray-800 dark:text-gray-200 font-medium">{date}</div>
                      <div className="text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {time}
                      </div>
                    </td>

                    {/* Cliente / Razón Social */}
                    <td className="py-3.5 px-4">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[200px]">
                        {pedido.factura?.razon_social || pedido.cliente_nombre || "Cliente Final"}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {pedido.factura?.nit ? `NIT/CI: ${pedido.factura.nit}` : "S/N"}
                      </div>
                    </td>

                    {/* Atendido por */}
                    <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-gray-400" />
                        <span>{pedido.empleado?.nombre || `Emp #${pedido.empleado_id}`}</span>
                      </div>
                    </td>

                    {/* Método de Pago */}
                    <td className="py-3.5 px-4">
                      {getMetodoBadge(pedido.factura?.metodo_pago)}
                    </td>

                    {/* Total */}
                    <td className="py-3.5 px-4 text-right font-semibold text-gray-900 dark:text-white">
                      {formatMoney(pedido.total)}
                    </td>

                    {/* Estado */}
                    <td className="py-3.5 px-4 text-center">
                      {getEstadoBadge(pedido.estado)}
                    </td>

                    {/* Acciones */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Ver Detalle */}
                        <button
                          type="button"
                          onClick={() => onViewDetail(pedido.id)}
                          title="Ver detalle completo de venta"
                          className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-brand-400 transition"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* Anular */}
                        <button
                          type="button"
                          onClick={() => onAnular(pedido)}
                          disabled={isAnulado}
                          title={
                            isAnulado
                              ? "Esta venta ya fue anulada"
                              : "Anular venta y comanda (Admin)"
                          }
                          className={`p-1.5 rounded-lg border transition ${
                            isAnulado
                              ? "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-600"
                              : "border-gray-200 bg-white text-gray-600 hover:text-error-600 hover:border-error-300 hover:bg-error-50/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-error-400"
                          }`}
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && pagination.total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3.5 border-t border-gray-100 bg-gray-50/40 dark:border-gray-800 dark:bg-gray-800/20 text-xs text-gray-500 dark:text-gray-400">
          <div>
            Mostrando <span className="font-semibold text-gray-700 dark:text-gray-200">{startRecord}</span> a{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">{endRecord}</span> de{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">{pagination.total}</span> ventas registradas
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Anterior
            </button>
            <span className="px-2 font-medium text-gray-700 dark:text-gray-300">
              Página {pagination.page} de {Math.max(1, pagination.totalPages)}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition"
            >
              Siguiente <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
