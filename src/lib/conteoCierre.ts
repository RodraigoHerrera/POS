// Helpers puros (client-safe) para el conteo y la conciliación en vivo del
// cierre de caja. Toda la aritmética monetaria se hace en centavos enteros
// para evitar residuos de punto flotante (3 x 0.1 => 0.3).

export const BILLETES = [200, 100, 50, 20, 10];
export const MONEDAS = [5, 2, 1, 0.5, 0.2, 0.1];

const aCentavos = (bs: number) => Math.round(bs * 100);
const aBs = (centavos: number) => centavos / 100;

/** Total en Bs del conteo (`counts` indexado por denominación, cantidades como string). */
export function totalConteo(counts: Record<string, string>): number {
  let centavos = 0;
  for (const denom of [...BILLETES, ...MONEDAS]) {
    const cantidad = parseInt(counts[String(denom)] || "0", 10);
    if (Number.isFinite(cantidad) && cantidad > 0) centavos += cantidad * aCentavos(denom);
  }
  return aBs(centavos);
}

/** Suma `delta` a una cantidad en texto; nunca baja de 0 y devuelve "" para 0. */
export function ajustarCantidad(actual: string, delta: number): string {
  const base = parseInt(actual || "0", 10);
  const siguiente = Math.max(0, (Number.isFinite(base) ? base : 0) + delta);
  return siguiente === 0 ? "" : String(siguiente);
}

const MONTO_VALIDO = /^\d+([.,]\d{1,2})?$/;

// Valida un monto declarado de forma estricta: no vacío, solo dígitos con hasta
// 2 decimales (sin signo negativo ni letras). Devuelve el número o un mensaje.
export function parsearMontoDeclarado(
  texto: string,
  nombre: string
): { valor: number } | { error: string } {
  const limpio = texto.trim();
  if (limpio === "") return { error: `${nombre} es obligatorio (ingresa 0 si no hubo cobros)` };
  if (!MONTO_VALIDO.test(limpio)) {
    return { error: `${nombre} debe ser un número mayor o igual a 0, con hasta 2 decimales` };
  }
  return { valor: Number(limpio.replace(",", ".")) };
}

export type EstadoConciliacion = "Exacta" | "Sobrante" | "Faltante" | "Pendiente";

export interface FilaConciliacion {
  metodo: "Efectivo" | "Tarjeta" | "QR";
  esperado: number;
  declarado: number | null;
  diferencia: number | null;
  estado: EstadoConciliacion;
}

function fila(
  metodo: FilaConciliacion["metodo"],
  esperado: number,
  declarado: number | null
): FilaConciliacion {
  if (declarado === null) {
    return { metodo, esperado, declarado: null, diferencia: null, estado: "Pendiente" };
  }
  const difCentavos = aCentavos(declarado) - aCentavos(esperado);
  const estado: EstadoConciliacion =
    difCentavos === 0 ? "Exacta" : difCentavos > 0 ? "Sobrante" : "Faltante";
  return { metodo, esperado, declarado, diferencia: aBs(difCentavos), estado };
}

function declaradoONull(texto: string): number | null {
  const r = parsearMontoDeclarado(texto, "");
  return "valor" in r ? r.valor : null;
}

/** Filas Esperado / Declarado / Diferencia por método, calculadas mientras se cuenta. */
export function conciliacionEnVivo(p: {
  efectivoEsperado: number;
  efectivoContado: number;
  tarjetaEsperado: number;
  tarjetaDeclarado: string;
  qrEsperado: number;
  qrDeclarado: string;
}): FilaConciliacion[] {
  return [
    fila("Efectivo", p.efectivoEsperado, p.efectivoContado),
    fila("Tarjeta", p.tarjetaEsperado, declaradoONull(p.tarjetaDeclarado)),
    fila("QR", p.qrEsperado, declaradoONull(p.qrDeclarado)),
  ];
}
