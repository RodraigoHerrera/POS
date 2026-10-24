import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mensajeErrorApi } from "./respuestaApi";

describe("mensajeErrorApi", () => {
  it("returns message when present", () => {
    assert.equal(mensajeErrorApi({ message: "Falló" }, "fb"), "Falló");
  });

  it("falls back to error when there is no message", () => {
    assert.equal(mensajeErrorApi({ error: "Boom" }, "fb"), "Boom");
  });

  it("prefers message over error", () => {
    assert.equal(mensajeErrorApi({ message: "M", error: "E" }, "fb"), "M");
  });

  it("returns fallback when neither is present", () => {
    assert.equal(mensajeErrorApi({}, "fb"), "fb");
  });

  it("ignores empty or non-string values", () => {
    assert.equal(mensajeErrorApi({ message: "", error: 5 }, "fb"), "fb");
  });

  it("returns fallback for non-object input", () => {
    assert.equal(mensajeErrorApi(null, "fb"), "fb");
    assert.equal(mensajeErrorApi(undefined, "fb"), "fb");
    assert.equal(mensajeErrorApi("texto", "fb"), "fb");
  });
});
