// Generador de CSV sin dependencias de servidor: se usa tanto en rutas como en
// componentes cliente (exportaciones descargadas desde el navegador).

export type Celda = string | number | null | undefined;

function escaparCelda(celda: Celda): string {
  if (celda === null || celda === undefined) return "";
  let texto: string;
  if (typeof celda === "number") {
    if (!Number.isFinite(celda)) return "";
    // Decimal comma: Spanish-locale Excel reads "1234.50" as 123450.
    texto = celda.toFixed(2).replace(".", ",");
  } else {
    texto = /^[=+\-@]/.test(celda) ? `'${celda}` : celda;
  }
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV con BOM UTF-8, separador ";", coma decimal y CRLF: formato de Excel con configuracion regional en espanol. */
export function generarCSV(cabeceras: readonly string[], filas: readonly (readonly Celda[])[]): string {
  const lineas = [cabeceras, ...filas].map((f) => f.map(escaparCelda).join(";"));
  return `﻿${lineas.join("\r\n")}\r\n`;
}

/** Decimal con coma y sin ceros de sobra: generarCSV fija 2 decimales y cantidades/costos usan hasta 6. */
export function decimalCSV(valor: number): string {
  if (!Number.isFinite(valor)) return "";
  return valor.toFixed(6).replace(/\.?0+$/, "").replace(".", ",");
}

/** Partes de fecha/hora en `tz` (por defecto la zona del navegador). */
export function partesFecha(fecha: Date, tz?: string): Record<string, string> {
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

/** `<prefijo>_YYYY-MM-DD.csv` con el dia local. */
export function nombreArchivoCSV(prefijo: string, fecha: Date, tz?: string): string {
  const f = partesFecha(fecha, tz);
  return `${prefijo}_${f.year}-${f.month}-${f.day}.csv`;
}

/** Solo navegador: dispara la descarga del CSV. */
export function descargarCSV(csv: string, nombreArchivo: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
