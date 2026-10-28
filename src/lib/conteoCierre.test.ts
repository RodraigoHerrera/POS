import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BILLETES,
  MONEDAS,
  totalConteo,
  ajustarCantidad,
  parsearMontoDeclarado,
  conciliacionEnVivo,
} from "./conteoCierre";

describe("denominaciones", () => {
  it("expone billetes y monedas", () => {
    assert.deepEqual(BILLETES, [200, 100, 50, 20, 10]);
    assert.deepEqual(MONEDAS, [5, 2, 1, 0.5, 0.2, 0.1]);
  });
});

describe("totalConteo", () => {
  it("vacío => 0", () => {
    assert.equal(totalConteo({}), 0);
  });
  it("suma billetes y monedas", () => {
    assert.equal(totalConteo({ "200": "2", "0.5": "3", "10": "1" }), 411.5);
  });
  it("evita residuo de punto flotante", () => {
    assert.equal(totalConteo({ "0.1": "3" }), 0.3);
    assert.equal(totalConteo({ "0.2": "3", "0.1": "1" }), 0.7);
  });
  it("ignora cantidades vacías o inválidas", () => {
    assert.equal(totalConteo({ "100": "", "50": "abc", "20": "2" }), 40);
  });
});

describe("ajustarCantidad", () => {
  it("incrementa desde vacío", () => {
    assert.equal(ajustarCantidad("", 1), "1");
  });
  it("incrementa y decrementa", () => {
    assert.equal(ajustarCantidad("5", 1), "6");
    assert.equal(ajustarCantidad("5", -1), "4");
  });
  it("nunca baja de 0 y devuelve vacío en 0", () => {
    assert.equal(ajustarCantidad("", -1), "");
    assert.equal(ajustarCantidad("1", -1), "");
    assert.equal(ajustarCantidad("0", -3), "");
  });
});

describe("parsearMontoDeclarado", () => {
  it("vacío => error obligatorio", () => {
    assert.deepEqual(parsearMontoDeclarado("  ", "Total Tarjeta"), {
      error: "Total Tarjeta es obligatorio (ingresa 0 si no hubo cobros)",
    });
  });
  it("rechaza negativos, letras y 3 decimales", () => {
    for (const t of ["-5", "abc", "1.234", "1,234", "1.", ".5"]) {
      const r = parsearMontoDeclarado(t, "Total QR");
      assert.ok("error" in r, t);
      assert.equal(
        (r as { error: string }).error,
        "Total QR debe ser un número mayor o igual a 0, con hasta 2 decimales"
      );
    }
  });
  it("acepta coma decimal y valores válidos", () => {
    assert.deepEqual(parsearMontoDeclarado("12,5", "x"), { valor: 12.5 });
    assert.deepEqual(parsearMontoDeclarado("0", "x"), { valor: 0 });
    assert.deepEqual(parsearMontoDeclarado(" 7.25 ", "x"), { valor: 7.25 });
  });
});

describe("conciliacionEnVivo", () => {
  const base = {
    efectivoEsperado: 100,
    efectivoContado: 100,
    tarjetaEsperado: 50,
    tarjetaDeclarado: "50",
    qrEsperado: 20,
    qrDeclarado: "20",
  };

  it("todo exacto", () => {
    const filas = conciliacionEnVivo(base);
    assert.deepEqual(
      filas.map((f) => [f.metodo, f.estado]),
      [
        ["Efectivo", "Exacta"],
        ["Tarjeta", "Exacta"],
        ["QR", "Exacta"],
      ]
    );
    assert.equal(filas[0].diferencia, 0);
  });
  it("sobrante y faltante", () => {
    const filas = conciliacionEnVivo({ ...base, efectivoContado: 103, tarjetaDeclarado: "47,5" });
    assert.equal(filas[0].estado, "Sobrante");
    assert.equal(filas[0].diferencia, 3);
    assert.equal(filas[1].estado, "Faltante");
    assert.equal(filas[1].declarado, 47.5);
    assert.equal(filas[1].diferencia, -2.5);
  });
  it("declarado vacío o inválido => Pendiente", () => {
    const filas = conciliacionEnVivo({ ...base, tarjetaDeclarado: "", qrDeclarado: "abc" });
    for (const f of filas.slice(1)) {
      assert.equal(f.estado, "Pendiente");
      assert.equal(f.declarado, null);
      assert.equal(f.diferencia, null);
    }
  });
  it("efectivo 0 contado con esperado > 0 es Faltante", () => {
    const filas = conciliacionEnVivo({ ...base, efectivoContado: 0 });
    assert.equal(filas[0].estado, "Faltante");
    assert.equal(filas[0].diferencia, -100);
  });
  it("sin residuo de punto flotante", () => {
    const filas = conciliacionEnVivo({
      ...base,
      efectivoEsperado: 0.3,
      efectivoContado: 0.1 + 0.2,
      tarjetaEsperado: 0.1 + 0.2,
      tarjetaDeclarado: "0.3",
    });
    assert.equal(filas[0].estado, "Exacta");
    assert.equal(filas[0].diferencia, 0);
    assert.equal(filas[1].estado, "Exacta");
  });
});
