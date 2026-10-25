import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ZONA_MRP_DEFAULT,
  claveDia,
  inicioDiaLocal,
  obtenerZonaMrp,
  offsetSegundos,
  rangoDias,
  sumarDias,
} from "./zonaHoraria";
import { construirSerieDiaria } from "./forecast";

const LA_PAZ = "America/La_Paz";

describe("zonaHoraria", () => {
  it("una venta a las 21:00 locales (01:00 UTC del dia siguiente) cae en su dia local", () => {
    const venta = new Date("2026-10-25T01:00:00Z"); // 24/10 21:00 en La Paz
    assert.equal(claveDia(venta, LA_PAZ), "2026-10-24");
    assert.equal(claveDia(venta, "UTC"), "2026-10-25");
  });

  it("obtenerZonaMrp usa el default si falta o es invalida", () => {
    assert.equal(obtenerZonaMrp(undefined), ZONA_MRP_DEFAULT);
    assert.equal(obtenerZonaMrp("No/Existe"), ZONA_MRP_DEFAULT);
    assert.equal(obtenerZonaMrp("UTC"), "UTC");
  });

  it("offsetSegundos devuelve -4h para La Paz", () => {
    assert.equal(offsetSegundos(new Date("2026-10-25T12:00:00Z"), LA_PAZ), -4 * 3600);
    assert.equal(offsetSegundos(new Date("2026-10-25T12:00:00Z"), "UTC"), 0);
  });

  it("sumarDias y rangoDias operan sobre claves YYYY-MM-DD", () => {
    assert.equal(sumarDias("2026-10-31", 1), "2026-11-01");
    assert.equal(sumarDias("2026-03-01", -1), "2026-02-28");
    assert.deepEqual(rangoDias("2026-10-30", "2026-11-01"), ["2026-10-30", "2026-10-31", "2026-11-01"]);
    assert.deepEqual(rangoDias("2026-11-02", "2026-11-01"), []);
  });
});

describe("construirSerieDiaria (zona de negocio)", () => {
  it("agrupa por dia local y no depende de la zona de la maquina", () => {
    const ventas = new Map<string, number>([
      ["2026-10-20", 5],
      ["2026-10-22", 3],
    ]);
    // inicio 19/10 20:00 local, fin 22/10 23:00 local (expresados en UTC)
    const serie = construirSerieDiaria(
      ventas,
      new Date("2026-10-20T00:00:00Z"),
      new Date("2026-10-23T03:00:00Z"),
      LA_PAZ
    );
    // primera venta 20/10 -> serie 20,21,22
    assert.deepEqual(serie, [5, 0, 3]);
  });

  it("incluye el dia local de fin aunque en UTC ya sea el siguiente", () => {
    const ventas = new Map<string, number>([["2026-10-24", 7]]);
    const serie = construirSerieDiaria(
      ventas,
      new Date("2026-10-23T16:00:00Z"), // 23/10 12:00 local
      new Date("2026-10-25T01:00:00Z"), // 24/10 21:00 local
      LA_PAZ
    );
    assert.deepEqual(serie, [7]);
  });
});

describe("inicioDiaLocal", () => {
  it("devuelve el instante UTC de la medianoche local", () => {
    assert.equal(inicioDiaLocal("2026-10-24", LA_PAZ).toISOString(), "2026-10-24T04:00:00.000Z");
    assert.equal(inicioDiaLocal("2026-10-24", "UTC").toISOString(), "2026-10-24T00:00:00.000Z");
  });
});
