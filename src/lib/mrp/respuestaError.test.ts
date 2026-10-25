import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { respuestaDeError } from "./respuestaError";
import { CorridaRecienteError, MENSAJE_CORRIDA_RECIENTE } from "./corridaReciente";
import { ValidationError } from "../validation";

describe("respuestaDeError", () => {
  it("CorridaRecienteError -> 409 con su mensaje", async () => {
    const r = respuestaDeError(new CorridaRecienteError(MENSAJE_CORRIDA_RECIENTE), "x");
    assert.equal(r.status, 409);
    assert.equal((await r.json()).error, MENSAJE_CORRIDA_RECIENTE);
  });
  it("ValidationError -> 400 con su mensaje", async () => {
    const r = respuestaDeError(new ValidationError("horizonteDias invalido"), "x");
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, "horizonteDias invalido");
  });
  it("otro error -> 500 generico sin filtrar detalles", async () => {
    const original = console.error;
    console.error = () => {};
    try {
      const r = respuestaDeError(new Error("boom interno"), "Error al ejecutar el MRP");
      assert.equal(r.status, 500);
      assert.equal((await r.json()).error, "Error al ejecutar el MRP");
    } finally {
      console.error = original;
    }
  });
});
