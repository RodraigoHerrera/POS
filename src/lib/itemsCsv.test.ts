import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { construirCSVItems, nombreArchivoItems, type ItemCSV } from "./itemsCsv";

const base: ItemCSV = {
  sku: "PAN-01",
  nombre: "Pan brioche",
  tipo: "insumo",
  unidad_code: "u",
  activo: true,
  costo_estandar: "0.123400",
};

function lineas(csv: string): string[] {
  return csv.replace(/^﻿/, "").split("\r\n").filter(Boolean);
}

describe("construirCSVItems", () => {
  it("writes the header row", () => {
    const [cabecera] = lineas(construirCSVItems([]));
    assert.equal(cabecera, "SKU;Nombre;Tipo;Unidad;Costo estándar;Estado");
  });

  it("writes one row per item with full precision standard cost", () => {
    const [, fila] = lineas(construirCSVItems([base]));
    assert.equal(fila, "PAN-01;Pan brioche;insumo;u;0,1234;Activo");
  });

  it("leaves missing SKU and standard cost empty and marks inactive items", () => {
    const [, fila] = lineas(construirCSVItems([{ ...base, sku: null, costo_estandar: null, activo: false }]));
    assert.equal(fila, ";Pan brioche;insumo;u;;Inactivo");
  });

  it("starts with a UTF-8 BOM so Excel reads accents", () => {
    assert.ok(construirCSVItems([base]).startsWith("﻿"));
  });
});

describe("nombreArchivoItems", () => {
  it("names the file with the local date", () => {
    assert.equal(nombreArchivoItems(new Date("2026-10-29T15:04:00Z"), "UTC"), "items_2026-10-29.csv");
  });
});
