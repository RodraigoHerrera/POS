import { generarCSV } from "@/lib/csv";

// Exportacion CSV del modal de Kardex. Recibe las filas tal como las devuelve
// /api/inventarios/kardex (ya filtradas en el cliente) y no toca la base.

export interface MovimientoKardexCSV {
  fecha: string;
  item: string;
  sku: string;
  unidad: string;
  tipo: string;
  motivo: string;
  referencia: string;
  empleado: string;
  cantidad: number;
  costo_unitario: number;
  total_movimiento: string;
  lote: string;
  vencimiento: string;
  anulado: boolean;
}

const CABECERAS = [
  "Fecha",
  "Item",
  "SKU",
  "Tipo",
  "Motivo",
  "Estado",
  "Referencia",
  "Lote",
  "Vencimiento",
  "Registrado por",
  "Cantidad",
  "Unidad",
  "Costo unitario",
  "Total",
] as const;

// Valores de relleno que la API usa para mostrar en pantalla; en el CSV van vacios.
const RELLENOS = new Set(["-", "N/A", "S/N"]);

const sinRelleno = (valor: string) => (RELLENOS.has(valor) ? "" : valor);

/** Decimal con coma y sin ceros de sobra: generarCSV fija 2 decimales y cantidades/costos usan hasta 6. */
function decimal(valor: number): string {
  if (!Number.isFinite(valor)) return "";
  return valor.toFixed(6).replace(/\.?0+$/, "").replace(".", ",");
}

function partesFecha(fecha: Date, tz?: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(fecha)) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return out;
}

/** `tz` por defecto es la zona del navegador. */
export function construirCSVKardex(movimientos: readonly MovimientoKardexCSV[], tz?: string): string {
  const filas = movimientos.map((m) => {
    const f = partesFecha(new Date(m.fecha), tz);
    return [
      `${f.year}-${f.month}-${f.day} ${f.hour}:${f.minute}`,
      m.item,
      sinRelleno(m.sku),
      m.tipo,
      m.motivo,
      m.anulado ? "Anulada" : "Vigente",
      sinRelleno(m.referencia),
      m.lote,
      sinRelleno(m.vencimiento),
      sinRelleno(m.empleado),
      decimal(m.cantidad),
      m.unidad,
      decimal(m.costo_unitario),
      Number(m.total_movimiento),
    ];
  });
  return generarCSV(CABECERAS, filas);
}

export function nombreArchivoKardex(fecha: Date, tz?: string): string {
  const f = partesFecha(fecha, tz);
  return `kardex_${f.year}-${f.month}-${f.day}.csv`;
}
