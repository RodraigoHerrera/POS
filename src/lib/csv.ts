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
