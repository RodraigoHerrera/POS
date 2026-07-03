"use client";

import React, { useState, useEffect } from "react";
import {
  Banknote,
  CreditCard,
  QrCode,
  Landmark,
  Gift,
  MoreHorizontal,
  Receipt,
  Loader2
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import TopBarCajero from "@/components/caja/TopBarCajero";

const PAYMENT_METHODS = [
  { id: "cash", label: "Efectivo", icon: <Banknote size={24} /> },
  { id: "card", label: "Tarjeta Crédito/Débito", icon: <CreditCard size={24} /> },
  { id: "qr", label: "Pago QR", icon: <QrCode size={24} /> },
  { id: "transfer", label: "Transferencia", icon: <Landmark size={24} /> },
  { id: "giftcard", label: "Gift Card", icon: <Gift size={24} /> },
  { id: "other", label: "Otros", icon: <MoreHorizontal size={24} /> },
];

interface SesionCaja {
  empleadoNombre: string;
  fechaApertura: string;
}

export default function PaymentMethods() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Obtiene el ID del pedido, su total real y el cliente de la URL
  // (?id=123&total=45.5&cliente=...). Esta página es una ruta de Next.js
  // (no un componente al que el padre le pasa props), por eso estos datos
  // tienen que venir de la URL y no de un prop con valor por defecto.
  const pedidoId = searchParams.get("id");
  const totalToPay = parseFloat(searchParams.get("total") || "0");
  const cliente = searchParams.get("cliente") || "";

  const [sesionCaja, setSesionCaja] = useState<SesionCaja | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);

  useEffect(() => {
    fetch("/api/caja/resumen", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSesionCaja({ empleadoNombre: data.empleadoNombre, fechaApertura: data.fechaApertura });
      })
      .catch(() => {});
  }, []);

  // --- Estados ---
  const [selectedMethod, setSelectedMethod] = useState<string>("cash");
  const [isProcessing, setIsProcessing] = useState(false);

  const [billingInfo, setBillingInfo] = useState({ nit: "", razonSocial: "" });

  // Lógica Efectivo
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [change, setChange] = useState<number>(0);

  // Lógica Tarjeta
  const [cardInfo, setCardInfo] = useState({ first4: "", last4: "" });

  // --- Efectos ---
  useEffect(() => {
    if (selectedMethod === "cash" && amountPaid) {
      const paid = parseFloat(amountPaid);
      const diff = paid - totalToPay;
      setChange(diff > 0 ? diff : 0);
    } else {
      setChange(0);
    }
  }, [amountPaid, selectedMethod, totalToPay]);

  // --- Handlers ---

  const handleConfirm = async () => {
    if (!pedidoId || totalToPay <= 0) return; // cubierto por el guard de render más abajo

    if (selectedMethod === "cash") {
      if (!amountPaid || parseFloat(amountPaid) < totalToPay) {
        return alert("El monto pagado es insuficiente o inválido.");
      }
    } else if (selectedMethod === "card") {
      if (cardInfo.first4.length < 4 || cardInfo.last4.length < 4) {
        return alert("Complete los dígitos de seguridad de la tarjeta.");
      }
    }

    const payload = {
      pedidoId: pedidoId,
      metodoPago: selectedMethod,
      montoPagado: selectedMethod === 'cash' ? parseFloat(amountPaid) : totalToPay,
      facturacion: {
        nit: billingInfo.nit || "0",
        razonSocial: billingInfo.razonSocial || "S/N"
      },
      detallesPago: selectedMethod === 'card' ? cardInfo : {}
    };

    try {
      setIsProcessing(true);

      const response = await fetch('/api/caja/facturacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error desconocido al procesar el cobro.");
      }

      alert(`✅ Cobro registrado! Factura #${data.facturaId || 'Generada'}`);
      router.push('/cajero/ventas');

    } catch (error: any) {
      console.error("Error en cobro:", error);
      alert(`❌ Error al procesar pago: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnular = async () => {
    if (!pedidoId) return;
    if (!confirm("¿Anular este pedido? El stock descontado por la comanda se repondrá.")) return;

    const motivo = prompt("Motivo de la anulación (opcional):") || undefined;

    try {
      setIsVoiding(true);

      const response = await fetch("/api/caja/anularPedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId, motivo }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error desconocido al anular el pedido.");
      }

      alert("✅ Pedido anulado y stock repuesto.");
      router.push("/cajero/ventas");
    } catch (error: any) {
      console.error("Error anulando pedido:", error);
      alert(`❌ Error al anular: ${error.message}`);
    } finally {
      setIsVoiding(false);
    }
  };

  // Navegación directa sin id/total válidos (ej. refresh, link a mano):
  // estado de pantalla en vez de un alert() bloqueante.
  if (!pedidoId || totalToPay <= 0) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-gray-50 text-center dark:bg-gray-900">
        <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
          No se encontró el pedido a cobrar.
        </p>
        <button
          onClick={() => router.push("/cajero/ventas")}
          className="rounded-lg bg-brand-500 px-6 py-2.5 font-medium text-white hover:bg-brand-600"
        >
          Volver a ventas
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-gray-50 dark:bg-gray-900">
      <TopBarCajero
        variant="contexto-pedido"
        empleadoNombre={sesionCaja?.empleadoNombre ?? ""}
        turnoInicio={sesionCaja?.fechaApertura}
        pedidoId={pedidoId}
        cliente={cliente}
        onVolver={() => router.push("/cajero/ventas")}
        onCerrarCaja={() => router.push("/cajero/cierre")}
      />

      <div className="w-full flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* COLUMNA IZQUIERDA: MÉTODOS DE PAGO */}
            <div className="lg:col-span-7 space-y-6">

              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <span className="bg-red-600 w-1 h-6 rounded-full block"></span>
                  Método de Pago
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PAYMENT_METHODS.map((method) => (
                    <label
                      key={method.id}
                      className={`cursor-pointer relative flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all duration-200
                        ${selectedMethod === method.id
                          ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-500 dark:text-red-400"
                          : "border-gray-100 bg-white hover:border-gray-300 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400"
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.id}
                        checked={selectedMethod === method.id}
                        onChange={() => setSelectedMethod(method.id)}
                        className="sr-only"
                        disabled={isProcessing}
                      />
                      {method.icon}
                      <span className="text-sm font-semibold text-center">{method.label}</span>

                      {selectedMethod === method.id && (
                        <div className="absolute top-2 right-2 w-3 h-3 bg-red-600 rounded-full animate-pulse" />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* DATOS DE FACTURACIÓN */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                 <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <Receipt size={20} className="text-gray-400" />
                  Datos de Facturación
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">NIT / CI</label>
                    <input
                      type="text"
                      disabled={isProcessing}
                      placeholder="0000000"
                      value={billingInfo.nit}
                      onChange={(e) => setBillingInfo({...billingInfo, nit: e.target.value})}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-red-500 focus:ring-red-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Razón Social</label>
                    <input
                      type="text"
                      disabled={isProcessing}
                      placeholder="Nombre Cliente"
                      value={billingInfo.razonSocial}
                      onChange={(e) => setBillingInfo({...billingInfo, razonSocial: e.target.value})}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-red-500 focus:ring-red-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* COLUMNA DERECHA: DETALLES Y CONFIRMACIÓN */}
            <div className="lg:col-span-5 space-y-6">

              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 h-full flex flex-col justify-between">

                <div>
                  <div className="text-center mb-8">
                    <p className="text-gray-500 dark:text-gray-400 mb-1">Total a Pagar</p>
                    <div className="text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                      Bs {totalToPay.toFixed(2)}
                    </div>
                  </div>

                  {/* EFECTIVO */}
                  {selectedMethod === "cash" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-100 dark:border-gray-700">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                          Monto Recibido
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Bs</span>
                          <input
                            type="number"
                            disabled={isProcessing}
                            value={amountPaid}
                            onChange={(e) => setAmountPaid(e.target.value)}
                            placeholder="0.00"
                            className="w-full rounded-xl border-2 border-gray-200 pl-10 pr-4 py-3 text-2xl font-bold text-gray-900 focus:border-red-500 focus:ring-0 dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:opacity-50"
                            autoFocus
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800/30">
                        <span className="font-semibold text-green-700 dark:text-green-400">Cambio / Vuelto</span>
                        <span className="text-2xl font-bold text-green-700 dark:text-green-400">
                          Bs {change.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* TARJETA */}
                  {selectedMethod === "card" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-100 dark:border-gray-700">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">
                          Validación de Tarjeta
                        </label>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <input
                              type="text"
                              maxLength={4}
                              disabled={isProcessing}
                              placeholder="XXXX"
                              value={cardInfo.first4}
                              onChange={(e) => setCardInfo({...cardInfo, first4: e.target.value.replace(/\D/g,'')})}
                              className="w-full text-center rounded-xl border-2 border-gray-200 py-3 text-lg font-mono font-medium text-gray-900 focus:border-red-500 focus:ring-0 dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:opacity-50"
                            />
                            <span className="text-xs text-center block mt-1 text-gray-400">Primeros 4</span>
                          </div>
                          <div className="text-gray-300 font-bold text-xl">••••</div>
                          <div className="flex-1">
                            <input
                              type="text"
                              maxLength={4}
                              disabled={isProcessing}
                              placeholder="XXXX"
                              value={cardInfo.last4}
                              onChange={(e) => setCardInfo({...cardInfo, last4: e.target.value.replace(/\D/g,'')})}
                              className="w-full text-center rounded-xl border-2 border-gray-200 py-3 text-lg font-mono font-medium text-gray-900 focus:border-red-500 focus:ring-0 dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:opacity-50"
                            />
                             <span className="text-xs text-center block mt-1 text-gray-400">Últimos 4</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 text-center">
                        Los datos de la tarjeta se guardan solo con fines de auditoría.
                      </p>
                    </div>
                  )}

                  {/* OTROS MÉTODOS */}
                  {['qr', 'transfer', 'giftcard', 'other'].includes(selectedMethod) && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-xl border border-blue-100 dark:border-blue-800 text-center animate-in fade-in">
                      <p className="text-blue-800 dark:text-blue-300 font-medium">
                        Procese el pago externamente y confirme la transacción.
                      </p>
                    </div>
                  )}
                </div>

                {/* BOTONES DE ACCIÓN */}
                <div className="mt-8 space-y-3">
                  <button
                    onClick={handleConfirm}
                    disabled={isProcessing || isVoiding}
                    className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] text-lg flex justify-center items-center gap-2
                      ${isProcessing || isVoiding
                        ? "bg-gray-400 cursor-not-allowed text-gray-100 shadow-none"
                        : "bg-red-600 hover:bg-red-700 text-white shadow-red-500/30"
                      }`}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      "Confirmar Cobro"
                    )}
                  </button>

                  <button
                    onClick={handleAnular}
                    disabled={isProcessing || isVoiding}
                    className="w-full py-3 rounded-xl border-2 border-gray-200 font-semibold text-gray-500 transition-all hover:border-red-300 hover:text-red-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-400 dark:hover:border-red-700 dark:hover:text-red-400 flex justify-center items-center gap-2"
                  >
                    {isVoiding ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Anulando...
                      </>
                    ) : (
                      "Anular pedido"
                    )}
                  </button>
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
