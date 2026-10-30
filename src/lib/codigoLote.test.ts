import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { esCodigoLoteDuplicado, resolverCodigoLote } from "./codigoLote";

const fecha = new Date("2026-10-30T15:04:00Z");
const aleatorio = () => "A1B2C3";

describe("resolverCodigoLote", () => {
  it("keeps the given code, trimmed", () => {
    assert.equal(resolverCodigoLote("  LT-99 ", fecha, aleatorio, "UTC"), "LT-99");
  });

  it("generates a code when the field is empty", () => {
    assert.equal(resolverCodigoLote("", fecha, aleatorio, "UTC"), "L-20261030-A1B2C3");
  });

  it("generates a code when the field is only whitespace", () => {
    assert.equal(resolverCodigoLote("   ", fecha, aleatorio, "UTC"), "L-20261030-A1B2C3");
  });

  it("generates a code when the field is missing or not a string", () => {
    assert.equal(resolverCodigoLote(undefined, fecha, aleatorio, "UTC"), "L-20261030-A1B2C3");
    assert.equal(resolverCodigoLote(null, fecha, aleatorio, "UTC"), "L-20261030-A1B2C3");
    assert.equal(resolverCodigoLote(123, fecha, aleatorio, "UTC"), "L-20261030-A1B2C3");
  });

  it("uses the local day of the given time zone", () => {
    const tarde = new Date("2026-10-31T02:00:00Z");
    assert.equal(resolverCodigoLote("", tarde, aleatorio, "America/La_Paz"), "L-20261030-A1B2C3");
  });

  it("generates different codes on each call by default", () => {
    const a = resolverCodigoLote("");
    const b = resolverCodigoLote("");
    assert.match(a, /^L-\d{8}-[0-9A-Z]{6}$/);
    assert.notEqual(a, b);
  });
});

describe("esCodigoLoteDuplicado", () => {
  it("detects a unique violation on the lot code index", () => {
    assert.equal(
      esCodigoLoteDuplicado({ code: "P2002", meta: { target: "lote_item_id_codigo_lote_key" } }),
      true
    );
    assert.equal(esCodigoLoteDuplicado({ code: "P2002", meta: { target: ["item_id", "codigo_lote"] } }), true);
  });

  it("ignores other errors", () => {
    assert.equal(esCodigoLoteDuplicado({ code: "P2002", meta: { target: "empleados_usuario_key" } }), false);
    assert.equal(esCodigoLoteDuplicado({ code: "P2025" }), false);
    assert.equal(esCodigoLoteDuplicado(new Error("boom")), false);
    assert.equal(esCodigoLoteDuplicado(null), false);
  });
});
