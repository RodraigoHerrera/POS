import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateStockThresholds,
  getStockStatus,
  calculateSuggestedRestock,
} from "./stockStatus";

test("validateStockThresholds", async (t) => {
  await t.test("acepta umbrales válidos", () => {
    assert.deepStrictEqual(validateStockThresholds(5, 20), { valid: true });
    assert.deepStrictEqual(validateStockThresholds(10, 0), { valid: true });
    assert.deepStrictEqual(validateStockThresholds(0, 0), { valid: true });
    assert.deepStrictEqual(validateStockThresholds(10, 10), { valid: true });
  });

  await t.test("rechaza valores negativos", () => {
    const resMin = validateStockThresholds(-1, 20);
    assert.strictEqual(resMin.valid, false);
    assert.match(resMin.error ?? "", /no pueden ser negativos/);

    const resMax = validateStockThresholds(5, -10);
    assert.strictEqual(resMax.valid, false);
    assert.match(resMax.error ?? "", /no pueden ser negativos/);
  });

  await t.test("rechaza stockMax menor que stockMin cuando stockMax > 0", () => {
    const res = validateStockThresholds(20, 10);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(
      res.error,
      "El stock máximo no puede ser menor que el stock mínimo"
    );
  });

  await t.test("rechaza valores no numéricos o NaN", () => {
    const resNaN = validateStockThresholds(NaN, 10);
    assert.strictEqual(resNaN.valid, false);
    assert.match(resNaN.error ?? "", /deben ser numéricos/);
  });
});

test("getStockStatus", async (t) => {
  await t.test("retorna 'sin_control' cuando no hay umbrales configurados", () => {
    const res1 = getStockStatus(10, 0, 0);
    assert.strictEqual(res1.key, "sin_control");
    assert.strictEqual(res1.label, "Sin calibrar");
    assert.strictEqual(res1.color, "light");

    const res2 = getStockStatus(0, 0);
    assert.strictEqual(res2.key, "sin_control");
  });

  await t.test("retorna 'critico' cuando stockMin > 0 y stock <= 0", () => {
    const resZero = getStockStatus(0, 10, 50);
    assert.strictEqual(resZero.key, "critico");
    assert.strictEqual(resZero.label, "Crítico");
    assert.strictEqual(resZero.color, "error");

    const resNeg = getStockStatus(-5, 10, 50);
    assert.strictEqual(resNeg.key, "critico");
    assert.strictEqual(resNeg.color, "error");
  });

  await t.test("retorna 'bajo' cuando stockMin > 0 y 0 < stock <= stockMin", () => {
    const resExact = getStockStatus(10, 10, 50);
    assert.strictEqual(resExact.key, "bajo");
    assert.strictEqual(resExact.label, "Bajo stock");
    assert.strictEqual(resExact.color, "warning");

    const resBelow = getStockStatus(3, 10, 50);
    assert.strictEqual(resBelow.key, "bajo");
    assert.strictEqual(resBelow.color, "warning");
  });

  await t.test("retorna 'normal' cuando el stock está entre el mínimo y el máximo", () => {
    const resMid = getStockStatus(25, 10, 50);
    assert.strictEqual(resMid.key, "normal");
    assert.strictEqual(resMid.label, "Saludable");
    assert.strictEqual(resMid.color, "success");

    const resMaxBoundary = getStockStatus(50, 10, 50);
    assert.strictEqual(resMaxBoundary.key, "normal");

    const resNoMax = getStockStatus(15, 10, 0);
    assert.strictEqual(resNoMax.key, "normal");
  });

  await t.test("retorna 'exceso' cuando el stock supera el máximo configurado", () => {
    const resOver = getStockStatus(51, 10, 50);
    assert.strictEqual(resOver.key, "exceso");
    assert.strictEqual(resOver.label, "Sobre-stock");
    assert.strictEqual(resOver.color, "info");

    const resOverNoMin = getStockStatus(100, 0, 50);
    assert.strictEqual(resOverNoMin.key, "exceso");
  });
});

test("calculateSuggestedRestock", async (t) => {
  await t.test("retorna 0 si no hay umbrales configurados", () => {
    assert.strictEqual(calculateSuggestedRestock(0, 0, 0), 0);
    assert.strictEqual(calculateSuggestedRestock(5, 0, 0), 0);
  });

  await t.test("retorna 0 si el stock actual está por encima del mínimo", () => {
    assert.strictEqual(calculateSuggestedRestock(15, 10, 50), 0);
    assert.strictEqual(calculateSuggestedRestock(50, 10, 50), 0);
  });

  await t.test("sugiere reponer hasta stockMax cuando stock <= stockMin", () => {
    // Al límite del mínimo (10) con max (50) -> reponer 40
    assert.strictEqual(calculateSuggestedRestock(10, 10, 50), 40);
    // Por debajo del mínimo (4) con max (50) -> reponer 46
    assert.strictEqual(calculateSuggestedRestock(4, 10, 50), 46);
    // En cero con max (50) -> reponer 50
    assert.strictEqual(calculateSuggestedRestock(0, 10, 50), 50);
    // Stock negativo (-5) con max (50) -> reponer 55
    assert.strictEqual(calculateSuggestedRestock(-5, 10, 50), 55);
  });

  await t.test("sugiere reponer hasta stockMin si no hay stockMax definido", () => {
    assert.strictEqual(calculateSuggestedRestock(3, 10, 0), 7);
    assert.strictEqual(calculateSuggestedRestock(10, 10, 0), 0);
    assert.strictEqual(calculateSuggestedRestock(12, 10, 0), 0);
  });
});
