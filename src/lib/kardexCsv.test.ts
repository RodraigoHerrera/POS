import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { construirCSVKardex, nombreArchivoKardex, type MovimientoKardexCSV } from "./kardexCsv";

const base: MovimientoKardexCSV = {
  fecha: "2026-10-29T15:04:00.000Z",
  item: "Pan brioche",
  sku: "PAN-01",
  unidad: "u",
  tipo: "Entrada",
  motivo: "Compra",
  referencia: "FAC-123",
  empleado: "Ana Pérez",
  cantidad: 12.5,
  costo_unitario: 0.123456,
  total_movimiento: "1.54",
  lote: "L-01",
  vencimiento: "2026-11-15",
  anulado: false,
};

function lineas(csv: string): string[] {
  return csv.replace(/^﻿/, "").split("\r\n").filter(Boolean);
}

describe("construirCSVKardex", () => {
  it("writes the header row including who registered the movement", () => {
    const [cabecera] = lineas(construirCSVKardex([], "UTC"));
    assert.equal(
      cabecera,
      "Fecha;Item;SKU;Tipo;Motivo;Estado;Referencia;Lote;Vencimiento;Registrado por;Cantidad;Unidad;Costo unitario;Total"
    );
  });

  it("writes one row per movement with local date and full precision quantities", () => {
    const [, fila] = lineas(construirCSVKardex([base], "UTC"));
    assert.equal(
      fila,
      "2026-10-29 15:04;Pan brioche;PAN-01;Entrada;Compra;Vigente;FAC-123;L-01;2026-11-15;Ana Pérez;12,5;u;0,123456;1,54"
    );
  });

  it("marks voided movements and blanks placeholder values", () => {
    const mov = { ...base, anulado: true, referencia: "-", empleado: "-", vencimiento: "N/A", sku: "S/N" };
    const [, fila] = lineas(construirCSVKardex([mov], "UTC"));
    assert.equal(fila, "2026-10-29 15:04;Pan brioche;;Entrada;Compra;Anulada;;L-01;;;12,5;u;0,123456;1,54");
  });

  it("uses the requested time zone for the date", () => {
    const [, fila] = lineas(construirCSVKardex([base], "America/La_Paz"));
    assert.ok(fila.startsWith("2026-10-29 11:04;"));
  });

  it("starts with a UTF-8 BOM so Excel reads accents", () => {
    assert.ok(construirCSVKardex([base], "UTC").startsWith("﻿"));
  });
});

describe("nombreArchivoKardex", () => {
  it("names the file with the local date", () => {
    assert.equal(nombreArchivoKardex(new Date("2026-10-29T15:04:00Z"), "UTC"), "kardex_2026-10-29.csv");
  });
});
