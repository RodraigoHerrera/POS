import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { agruparPorProveedor, cantidadOrden, esUnidadEntera } from "./ordenes";

const fecha = new Date("2026-10-25T00:00:00Z");

describe("esUnidadEntera / cantidadOrden", () => {
  it("unidades contadas son enteras", () => {
    for (const u of ["u", "U", " unidad ", "caja", "paquete", "und"]) assert.equal(esUnidadEntera(u), true, u);
  });
  it("unidades de peso/volumen no", () => {
    for (const u of ["kg", "g", "L", "ml", "litro", "kilogramo", "gramo", "mililitro", null, undefined]) {
      assert.equal(esUnidadEntera(u), false, String(u));
    }
  });
  it("redondea hacia arriba solo las unidades enteras", () => {
    assert.equal(cantidadOrden(2.1, "u"), 3);
    assert.equal(cantidadOrden(3, "u"), 3);
    assert.equal(cantidadOrden(3.0000000001, "u"), 3);
    assert.equal(cantidadOrden(2.1, "kg"), 2.1);
  });
});

describe("agruparPorProveedor - cantidades", () => {
  it("la OC de un item en unidades lleva cantidad entera y el total la usa", () => {
    const { ordenes } = agruparPorProveedor([
      { itemId: "1", necesidadNeta: 2.1, proveedorId: "P", costoUnitEstimado: 10, fechaSugeridaEmision: fecha, unidadCode: "u" },
      { itemId: "2", necesidadNeta: 2.1, proveedorId: "P", costoUnitEstimado: 10, fechaSugeridaEmision: fecha, unidadCode: "kg" },
    ]);
    assert.deepEqual(ordenes[0].items.map((i) => i.cantidad), [3, 2.1]);
    assert.equal(ordenes[0].total, 3 * 10 + 2.1 * 10);
  });
});
