import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rutaPorRol } from "./rutaPorRol";

describe("rutaPorRol", () => {
  it("sends Administrador to /admin and Cajero to /cajero", () => {
    assert.equal(rutaPorRol("Administrador"), "/admin");
    assert.equal(rutaPorRol("Cajero"), "/cajero");
  });

  it("returns null for an unknown or missing role", () => {
    assert.equal(rutaPorRol("Cocinero"), null);
    assert.equal(rutaPorRol(""), null);
    assert.equal(rutaPorRol(undefined), null);
    assert.equal(rutaPorRol(42), null);
  });
});
