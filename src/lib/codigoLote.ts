import { randomInt } from "node:crypto";

// Codigo de lote de una entrada de inventario. El campo "Lote" del formulario
// es opcional, pero codigo_lote es unico por item en TODAS las sucursales: con
// "" solo la primera entrada sin codigo de cada item se guardaba y las demas
// reventaban con P2002 (500). Si viene vacio se genera uno.

const ALFABETO = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function sufijoAleatorio(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return s;
}

function diaLocal(fecha: Date, tz?: string): string {
  const p: Record<string, string> = {};
  for (const parte of new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha)) {
    if (parte.type !== "literal") p[parte.type] = parte.value;
  }
  return `${p.year}${p.month}${p.day}`;
}

/** Codigo recibido sin espacios, o `L-YYYYMMDD-XXXXXX` si vino vacio o ausente. */
export function resolverCodigoLote(
  codigo: unknown,
  fecha: Date = new Date(),
  aleatorio: () => string = sufijoAleatorio,
  tz?: string
): string {
  const limpio = typeof codigo === "string" ? codigo.trim() : "";
  if (limpio) return limpio;
  return `L-${diaLocal(fecha, tz)}-${aleatorio()}`;
}

/** P2002 sobre el indice unico (item_id, codigo_lote) de la tabla lote. */
export function esCodigoLoteDuplicado(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: unknown; meta?: { target?: unknown } };
  return e.code === "P2002" && String(e.meta?.target ?? "").includes("codigo_lote");
}
