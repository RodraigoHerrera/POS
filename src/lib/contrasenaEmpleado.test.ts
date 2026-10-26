import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validarNuevaContrasena, LONGITUD_MINIMA_CONTRASENA } from "./contrasenaEmpleado";

describe("validarNuevaContrasena", () => {
  it("accepts a password that meets the minimum length and matches its confirmation", () => {
    assert.equal(validarNuevaContrasena("1234", "1234"), null);
  });

  it("rejects an empty password", () => {
    assert.match(validarNuevaContrasena("", "") ?? "", /requerida/i);
  });

  it("rejects a whitespace-only password", () => {
    assert.match(validarNuevaContrasena("    ", "    ") ?? "", /requerida/i);
  });

  it("rejects a password shorter than the minimum length", () => {
    const corta = "1".repeat(LONGITUD_MINIMA_CONTRASENA - 1);
    assert.match(validarNuevaContrasena(corta, corta) ?? "", /al menos/i);
  });

  it("rejects a password that does not match its confirmation", () => {
    assert.match(validarNuevaContrasena("1234", "4321") ?? "", /no coinciden/i);
  });

  it("rejects non-string input", () => {
    assert.match(validarNuevaContrasena(1234 as unknown, 1234 as unknown) ?? "", /requerida/i);
  });

  it("skips the confirmation check when no confirmation is provided (server side)", () => {
    assert.equal(validarNuevaContrasena("1234"), null);
  });
});
