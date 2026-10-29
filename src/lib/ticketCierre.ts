// Modelo de vista del ticket de cierre de caja (función pura, sin I/O).
// Se construye a partir de la respuesta de POST /api/caja/cerrar.

export interface VentasPorMetodo {
  ventas_efectivo: number;
  ventas_tarjeta: number;
  ventas_qr: number;
  ventas_transfer: number;
  ventas_giftcard: number;
  ventas_otros: number;
}

export interface CierreCajaData {
  cajaId: number | string;
  empleadoNombre: string;
  fechaApertura: string;
  fechaCierre: string;
  saldoInicial: number;
  ventasPorMetodo: VentasPorMetodo;
  totalVentas: number;
  entradasEfectivo: number;
  salidasEfectivo: number;
  efectivoEsperado: number;
  totalContado: number;
  diferenciaEfectivo: number;
  tarjetaEsperado: number;
  totalTarjeta: number;
  diferenciaTarjeta: number;
  qrEsperado: number;
  totalQr: number;
  diferenciaQr: number;
}

export type EtiquetaDiferencia = "Exacta" | "Sobrante" | "Faltante";

export interface FilaConciliacion {
  metodo: "Efectivo" | "Tarjeta" | "QR";
  esperado: string;
  declarado: string;
  diferencia: { etiqueta: EtiquetaDiferencia; monto: string };
}

export interface TicketCierre {
  cajaId: string;
  empleadoNombre: string;
  fechaApertura: string;
  fechaCierre: string;
  lineasMetodo: { etiqueta: string; monto: string }[];
  totalVentas: string;
  saldoInicial: string;
  entradasEfectivo: string;
  salidasEfectivo: string;
  // Efectivo esperado/contado y su diferencia viven solo en `conciliacion`.
  conciliacion: FilaConciliacion[];
}

// Orden fijo de los métodos de pago en el ticket.
const METODOS: { clave: keyof VentasPorMetodo; etiqueta: string }[] = [
  { clave: "ventas_efectivo", etiqueta: "Efectivo" },
  { clave: "ventas_tarjeta", etiqueta: "Tarjeta" },
  { clave: "ventas_qr", etiqueta: "QR" },
  { clave: "ventas_transfer", etiqueta: "Transferencia" },
  { clave: "ventas_giftcard", etiqueta: "Gift Card" },
  { clave: "ventas_otros", etiqueta: "Otros" },
];

export function formatearBs(monto: number): string {
  return `Bs ${(Number(monto) || 0).toFixed(2)}`;
}

function clasificarDiferencia(diferencia: number): { etiqueta: EtiquetaDiferencia; monto: string } {
  if (Math.abs(diferencia) < 0.01) return { etiqueta: "Exacta", monto: formatearBs(0) };
  return {
    etiqueta: diferencia > 0 ? "Sobrante" : "Faltante",
    monto: formatearBs(Math.abs(diferencia)),
  };
}

export function construirTicketCierre(data: CierreCajaData): TicketCierre {
  return {
    cajaId: String(data.cajaId),
    empleadoNombre: data.empleadoNombre,
    fechaApertura: data.fechaApertura,
    fechaCierre: data.fechaCierre,
    lineasMetodo: METODOS.map(({ clave, etiqueta }) => ({
      etiqueta,
      monto: formatearBs(data.ventasPorMetodo[clave]),
    })),
    totalVentas: formatearBs(data.totalVentas),
    saldoInicial: formatearBs(data.saldoInicial),
    entradasEfectivo: formatearBs(data.entradasEfectivo),
    salidasEfectivo: formatearBs(data.salidasEfectivo),
    // Conciliación por método auditado, en orden fijo: Efectivo, Tarjeta, QR.
    conciliacion: [
      {
        metodo: "Efectivo",
        esperado: formatearBs(data.efectivoEsperado),
        declarado: formatearBs(data.totalContado),
        diferencia: clasificarDiferencia(data.diferenciaEfectivo),
      },
      {
        metodo: "Tarjeta",
        esperado: formatearBs(data.tarjetaEsperado),
        declarado: formatearBs(data.totalTarjeta),
        diferencia: clasificarDiferencia(data.diferenciaTarjeta),
      },
      {
        metodo: "QR",
        esperado: formatearBs(data.qrEsperado),
        declarado: formatearBs(data.totalQr),
        diferencia: clasificarDiferencia(data.diferenciaQr),
      },
    ],
  };
}
