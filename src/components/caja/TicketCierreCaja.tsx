"use client";

import { construirTicketCierre, type CierreCajaData } from "@/lib/ticketCierre";

interface Props {
  cierre: CierreCajaData;
  onSalir: () => void;
  saliendo?: boolean;
}

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? "N/A" : fecha.toLocaleString("es-MX");
}

// Ticket de cierre de caja (80mm, estilo comanda). Al imprimir solo se ve el
// ticket: los botones llevan print:hidden y el fondo/padding de la página se
// reinician con las clases print:.
export default function TicketCierreCaja({ cierre, onSalir, saliendo = false }: Props) {
  const t = construirTicketCierre(cierre);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 py-8 print:bg-white print:py-0 print:min-h-0">
      <div className="mb-4 print:hidden flex gap-4">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition-colors"
        >
          Imprimir
        </button>
        <button
          onClick={onSalir}
          disabled={saliendo}
          className="px-4 py-2 bg-gray-300 text-black rounded shadow hover:bg-gray-400 transition-colors disabled:opacity-50"
        >
          {saliendo ? "Cerrando sesión..." : "Salir"}
        </button>
      </div>

      <div className="bg-white p-4 shadow-sm max-w-[80mm] w-full text-black font-mono text-sm print:shadow-none print:p-0 print:m-0 print:max-w-none">
        <div className="text-center mb-4">
          <h1 className="font-bold text-lg mb-1">SMASH POS</h1>
          <p className="text-xs">Cierre de Caja</p>
          <p className="text-xs">Caja: #{t.cajaId}</p>
          <p className="text-xs">Cajero: {t.empleadoNombre || "N/A"}</p>
          <p className="text-xs">Apertura: {formatearFecha(t.fechaApertura)}</p>
          <p className="text-xs">Cierre: {formatearFecha(t.fechaCierre)}</p>
        </div>

        <div className="border-t border-b border-black py-2 mb-4">
          <p className="font-bold mb-1">Ventas por método</p>
          {t.lineasMetodo.map((l) => (
            <div key={l.etiqueta} className="flex justify-between">
              <span>{l.etiqueta}</span>
              <span className="tabular-nums">{l.monto}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold border-t border-black mt-1 pt-1">
            <span>Total ventas</span>
            <span className="tabular-nums">{t.totalVentas}</span>
          </div>
        </div>

        <div className="border-b border-black pb-2 mb-4">
          <div className="flex justify-between">
            <span>Caja abierta con</span>
            <span className="tabular-nums">{t.saldoInicial}</span>
          </div>
          <div className="flex justify-between">
            <span>Efectivo esperado</span>
            <span className="tabular-nums">{t.efectivoEsperado}</span>
          </div>
          <div className="flex justify-between">
            <span>Caja cerrada con</span>
            <span className="tabular-nums">{t.totalContado}</span>
          </div>
          <div className="flex justify-between font-bold mt-1">
            <span>{t.diferencia.etiqueta}</span>
            <span className="tabular-nums">{t.diferencia.monto}</span>
          </div>
        </div>

        <div className="border-b border-black pb-2 mb-4">
          <p className="font-bold mb-1">Conciliación</p>
          {t.conciliacion.map((c) => (
            <div key={c.metodo} className="mb-2 last:mb-0" data-testid={`conciliacion-${c.metodo}`}>
              <p className="font-bold">{c.metodo}</p>
              <div className="flex justify-between text-xs">
                <span>Esperado (Sistema)</span>
                <span className="tabular-nums">{c.esperado}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Declarado (Manual)</span>
                <span className="tabular-nums">{c.declarado}</span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span>Diferencia: {c.diferencia.etiqueta}</span>
                <span className="tabular-nums">{c.diferencia.monto}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-6 text-xs">
          <p>-- Fin de Cierre --</p>
        </div>
      </div>
    </div>
  );
}
