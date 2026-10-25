import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseHorizonteDias, parseCorridaId } from "./validacion";
import { ValidationError } from "../validation";

describe("parseHorizonteDias", () => {
  it("ausente da el default 7", () => {
    assert.equal(parseHorizonteDias(undefined), 7);
    assert.equal(parseHorizonteDias(null), 7);
  });
  it("acepta enteros 1..60 (numero o string)", () => {
    assert.equal(parseHorizonteDias(1), 1);
    assert.equal(parseHorizonteDias(60), 60);
    assert.equal(parseHorizonteDias("14"), 14);
  });
  it("rechaza no enteros, fuera de rango y basura con ValidationError", () => {
    for (const v of [7.5, 0, -1, 61, "abc", "7.5", NaN, true, {}, ""]) {
      assert.throws(() => parseHorizonteDias(v), ValidationError, String(v));
    }
  });
});

describe("parseCorridaId", () => {
  it("convierte ids numericos a bigint", () => {
    assert.equal(parseCorridaId("42"), BigInt(42));
  });
  it("rechaza ids no numericos con ValidationError", () => {
    for (const v of ["abc", "1x", "-3", "0", "", "1.5"]) {
      assert.throws(() => parseCorridaId(v), ValidationError, v);
    }
  });
});
