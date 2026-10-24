import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "./validation";
import { isDeadlockError } from "./transactionRetry";
import { evaluarEditabilidad, type EstadoEdicionEntrada } from "./entradaEdicion";
import {
  validarAnulacionEntrada,
  evaluarAnulabilidad,
  AnulacionEntradaError,
  mapearErrorAnulacion,
} from "./entradaAnulacion";

const estadoBase: EstadoEdicionEntrada = {
  tipo: "Entrada",
  motivo: "Compra",
  loteId: BigInt(50),
  movimientoId: BigInt(10),
  cantidadMovimiento: 10,
  primerMovimientoLoteId: BigInt(10),
  totalMovimientosLote: 1,
  consumosProduccionLote: 0,
  cantidadStockLote: 10,
};

describe("validarAnulacionEntrada", () => {
  it("accepts an absent body or absent motivo as no reason", () => {
    assert.deepEqual(validarAnulacionEntrada(null), { motivo: null });
    assert.deepEqual(validarAnulacionEntrada(undefined), { motivo: null });
    assert.deepEqual(validarAnulacionEntrada({}), { motivo: null });
    assert.deepEqual(validarAnulacionEntrada({ motivo: null }), { motivo: null });
  });

  it("trims motivo and maps empty to null", () => {
    assert.deepEqual(validarAnulacionEntrada({ motivo: "  Error de digitación " }), {
      motivo: "Error de digitación",
    });
    assert.deepEqual(validarAnulacionEntrada({ motivo: "   " }), { motivo: null });
    assert.deepEqual(validarAnulacionEntrada({ motivo: "" }), { motivo: null });
  });

  it("limits motivo to 255 characters", () => {
    assert.deepEqual(validarAnulacionEntrada({ motivo: "m".repeat(255) }), { motivo: "m".repeat(255) });
    assert.throws(() => validarAnulacionEntrada({ motivo: "m".repeat(256) }), ValidationError);
  });

  it("rejects non-string motivo and non-object bodies", () => {
    assert.throws(() => validarAnulacionEntrada({ motivo: 5 }), ValidationError);
    assert.throws(() => validarAnulacionEntrada([]), ValidationError);
    assert.throws(() => validarAnulacionEntrada("x"), ValidationError);
  });
});

describe("evaluarAnulabilidad", () => {
  it("allows an untouched manual entry", () => {
    assert.deepEqual(evaluarAnulabilidad(estadoBase), { anulable: true });
    for (const motivo of ["Compra", "Ajuste", "Traslado"]) {
      assert.deepEqual(evaluarAnulabilidad({ ...estadoBase, motivo }), { anulable: true });
    }
  });

  it("reports not found when there is no state", () => {
    assert.deepEqual(evaluarAnulabilidad(null), { anulable: false, codigo: "ENTRADA_NO_ENCONTRADA" });
  });

  it("rejects non-manual movements", () => {
    for (const parcial of [{ tipo: "Salida" }, { motivo: "Produccion" }, { loteId: null }]) {
      assert.deepEqual(evaluarAnulabilidad({ ...estadoBase, ...parcial }), {
        anulable: false,
        codigo: "ENTRADA_NO_ANULABLE",
      });
    }
  });

  it("rejects a restoration movement that is not the originating one", () => {
    const r = evaluarAnulabilidad({
      ...estadoBase,
      motivo: "Ajuste",
      primerMovimientoLoteId: BigInt(3),
      totalMovimientosLote: 2,
    });
    assert.deepEqual(r, { anulable: false, codigo: "ENTRADA_NO_ANULABLE" });
  });

  it("rejects an already voided entry with its own code", () => {
    assert.deepEqual(evaluarAnulabilidad({ ...estadoBase, anulado: true }), {
      anulable: false,
      codigo: "ENTRADA_YA_ANULADA",
    });
  });

  it("rejects a consumed lote", () => {
    const casos: Array<Partial<EstadoEdicionEntrada>> = [
      { totalMovimientosLote: 2 },
      { consumosProduccionLote: 1 },
      { cantidadStockLote: 6 },
      { cantidadStockLote: null },
    ];
    for (const parcial of casos) {
      assert.deepEqual(evaluarAnulabilidad({ ...estadoBase, ...parcial }), {
        anulable: false,
        codigo: "ENTRADA_NO_ANULABLE",
      });
    }
  });
});

describe("evaluarEditabilidad with voided entries", () => {
  it("treats a voided entry as not editable at all", () => {
    assert.deepEqual(evaluarEditabilidad({ ...estadoBase, anulado: true }), {
      editable: false,
      cantidadCostoEditables: false,
    });
  });

  it("keeps behavior unchanged when anulado is false or omitted", () => {
    const esperado = { editable: true, cantidadCostoEditables: true };
    assert.deepEqual(evaluarEditabilidad(estadoBase), esperado);
    assert.deepEqual(evaluarEditabilidad({ ...estadoBase, anulado: false }), esperado);
  });
});

describe("mapearErrorAnulacion", () => {
  it("maps domain errors to their status", () => {
    const casos = [
      ["ENTRADA_NO_ENCONTRADA", 404],
      ["ENTRADA_YA_ANULADA", 409],
      ["ENTRADA_NO_ANULABLE", 409],
    ] as const;
    for (const [codigo, status] of casos) {
      const r = mapearErrorAnulacion(new AnulacionEntradaError(codigo));
      assert.equal(r.status, status);
      assert.ok(typeof r.body.message === "string" && r.body.message.length > 0);
    }
  });

  it("maps ValidationError to 400 and unknown errors to 500", () => {
    assert.equal(mapearErrorAnulacion(new ValidationError("x")).status, 400);
    const r = mapearErrorAnulacion(new Error("boom"));
    assert.equal(r.status, 500);
    assert.deepEqual(r.body, { error: "Error al anular la entrada" });
  });

  it("never produces messages that look like deadlocks", () => {
    for (const codigo of ["ENTRADA_NO_ENCONTRADA", "ENTRADA_YA_ANULADA", "ENTRADA_NO_ANULABLE"] as const) {
      assert.equal(isDeadlockError(new AnulacionEntradaError(codigo)), false, codigo);
    }
  });
});
