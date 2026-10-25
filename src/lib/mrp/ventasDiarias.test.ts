import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { agruparFilasVentas } from "./ventasDiarias";

describe("agruparFilasVentas", () => {
  it("arma el mapa producto -> dia -> cantidad con tipos de MySQL (bigint/decimal/number)", () => {
    const filas = [
      { producto_id: BigInt(1), dia: "2026-10-24", total: BigInt(5) },
      { producto_id: BigInt(1), dia: "2026-10-25", total: "3" },
      { producto_id: 2, dia: "2026-10-24", total: { valueOf: () => "4" } },
    ];
    const m = agruparFilasVentas(filas as never);
    assert.equal(m.get("1")?.get("2026-10-24"), 5);
    assert.equal(m.get("1")?.get("2026-10-25"), 3);
    assert.equal(m.get("2")?.get("2026-10-24"), 4);
  });

  it("suma filas repetidas del mismo dia y descarta totales nulos o invalidos", () => {
    const filas = [
      { producto_id: BigInt(1), dia: "2026-10-24", total: 2 },
      { producto_id: BigInt(1), dia: "2026-10-24", total: 3 },
      { producto_id: BigInt(1), dia: "2026-10-23", total: null },
    ];
    const m = agruparFilasVentas(filas as never);
    assert.equal(m.get("1")?.get("2026-10-24"), 5);
    assert.equal(m.get("1")?.has("2026-10-23"), false);
  });
});
