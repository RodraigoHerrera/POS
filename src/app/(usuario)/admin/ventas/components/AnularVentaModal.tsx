"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Info,
  CheckCircle2,
  Receipt,
  Banknote,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { PedidoSaleRecord } from "./VentasTable";

interface AnularVentaModalProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: PedidoSaleRecord | null;
  onSuccess: () => void;
}

export default function AnularVentaModal({
  isOpen,
  onClose,
  pedido,
  onSuccess,
}: AnularVentaModalProps) {
  const [resolucion, setResolucion] = useState<"REPONER" | "MERMA">("REPONER");
  const [motivo, setMotivo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  if (!pedido) return null;

  const isMotivoValid = motivo.trim().length >= 5;
  const isEfectivo =
    (pedido.factura?.metodo_pago || "").toLowerCase() === "cash" ||
    (pedido.factura?.metodo_pago || "").toLowerCase() === "efectivo";

  const handleClose = () => {
    if (isSubmitting) return;
    setMotivo("");
    setResolucion("REPONER");
    setTouched(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isMotivoValid || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/admin/ventas/${pedido.id}/anular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo: motivo.trim(),
          resolucion_inventario: resolucion,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}: ${res.statusText}`);
      }

      if (data.alertaCajaCerrada && data.mensajeAlerta) {
        toast.warning(data.mensajeAlerta, { duration: 6000 });
      } else {
        toast.success("Venta anulada y registros actualizados correctamente");
      }

      handleClose();
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Error al anular la venta");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className="max-w-xl p-6 sm:p-7 max-h-[92vh] flex flex-col overflow-hidden"
    >
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800 pr-8">
        <div className="h-10 w-10 rounded-xl bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400 flex items-center justify-center shrink-0">
          <Ban className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Anular Venta #{pedido.id}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Total a revertir:{" "}
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              Bs {Number(pedido.total).toFixed(2)}
            </span>{" "}
            • Cliente: {pedido.factura?.razon_social || pedido.cliente_nombre || "Cliente Final"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4">
        {/* Cash drawer alert banner */}
        {isEfectivo && (
          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold">Venta cobrada en efectivo</p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300/90 mt-0.5">
                Si el turno de caja #{pedido.caja_id || "asociado"} sigue abierto, se creará un egreso de devolución de caja automáticamente. Si ya fue cerrado, se registrará una nota de conciliación en el arqueo del turno.
              </p>
            </div>
          </div>
        )}

        {/* Inventory Resolution Cards */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Resolución de Inventario e Insumos *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* REPONER Card */}
            <div
              onClick={() => setResolucion("REPONER")}
              className={`cursor-pointer rounded-xl border p-3.5 transition-all text-left flex flex-col justify-between ${
                resolucion === "REPONER"
                  ? "border-brand-500 bg-brand-50/30 ring-2 ring-brand-500/20 dark:border-brand-500 dark:bg-brand-500/10"
                  : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-800/40"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                    <RotateCcw className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    REPONER STOCK
                  </span>
                  <div
                    className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      resolucion === "REPONER"
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {resolucion === "REPONER" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  Reingresa los insumos a sus lotes originales (FEFO) y restaura el stock en sucursal. Ideal cuando los platos <strong>no se cocinaron</strong>.
                </p>
              </div>
            </div>

            {/* MERMA Card */}
            <div
              onClick={() => setResolucion("MERMA")}
              className={`cursor-pointer rounded-xl border p-3.5 transition-all text-left flex flex-col justify-between ${
                resolucion === "MERMA"
                  ? "border-brand-500 bg-brand-50/30 ring-2 ring-brand-500/20 dark:border-brand-500 dark:bg-brand-500/10"
                  : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-800/40"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                    <Trash2 className="h-4 w-4 text-error-600 dark:text-error-400" />
                    DECLARAR MERMA
                  </span>
                  <div
                    className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      resolucion === "MERMA"
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {resolucion === "MERMA" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  Mantiene el inventario descontado y registra salida por <strong>Merma</strong> en el Kardex. Ideal cuando el plato <strong>se desechó o se quemó</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Motivo textarea */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Motivo de la Anulación *
            </label>
            <span
              className={`text-[11px] ${
                motivo.trim().length >= 5
                  ? "text-emerald-600 dark:text-emerald-400 font-medium"
                  : "text-gray-400"
              }`}
            >
              {motivo.trim().length} / 5 carácteres mín.
            </span>
          </div>
          <textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Describa claramente la justificación de la anulación (mínimo 5 caracteres)..."
            className={`w-full rounded-xl border p-3 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 dark:bg-gray-800/50 dark:text-gray-100 ${
              touched && !isMotivoValid
                ? "border-error-500 focus:border-error-500 focus:ring-error-500/20"
                : "border-gray-200 focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700"
            }`}
          />
          {touched && !isMotivoValid && (
            <p className="text-[11px] text-error-600 dark:text-error-400 mt-1">
              El motivo es obligatorio y debe tener al menos 5 caracteres.
            </p>
          )}
        </div>

        {/* Action Warning Note */}
        <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400">
          Esta acción marcará el pedido como <strong>ANULADO</strong>, purgará las métricas de venta en los reportes de Business Intelligence y registrará su usuario como responsable en la bitácora de auditoría.
        </div>

        {/* Form Buttons */}
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!isMotivoValid || isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-error-600 text-xs font-semibold text-white shadow-theme-xs hover:bg-error-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isSubmitting ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-solid border-white border-r-transparent" />
                Procesando anulación...
              </>
            ) : (
              <>
                <Ban className="h-3.5 w-3.5" />
                Confirmar Anulación
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
