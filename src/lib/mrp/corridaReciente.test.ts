import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { corridaReciente, VENTANA_CORRIDA_MS } from "./corridaReciente";

const ahora = new Date("2026-10-25T12:00:00Z");

describe("corridaReciente", () => {
  it("rechaza si la ultima corrida esta dentro de la ventana", () => {
    assert.equal(corridaReciente(new Date(ahora.getTime() - 5_000), ahora), true);
  });
  it("permite si la ultima corrida esta fuera de la ventana", () => {
    assert.equal(corridaReciente(new Date(ahora.getTime() - VENTANA_CORRIDA_MS - 1), ahora), false);
  });
  it("permite si no hay corrida previa", () => {
    assert.equal(corridaReciente(null, ahora), false);
  });
  it("permite justo en el limite de la ventana", () => {
    assert.equal(corridaReciente(new Date(ahora.getTime() - VENTANA_CORRIDA_MS), ahora), false);
  });
  it("rechaza si la ultima corrida esta levemente en el futuro (desfase de reloj chico)", () => {
    assert.equal(corridaReciente(new Date(ahora.getTime() + 5_000), ahora), true);
  });
  it("permite si la ultima corrida esta muy en el futuro (desfase de reloj o zona horaria)", () => {
    assert.equal(corridaReciente(new Date(ahora.getTime() + 4 * 60 * 60 * 1000), ahora), false);
  });
});
