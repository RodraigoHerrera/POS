import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { RateLimitResult } from "../rate-limit";
import {
  claveLimiteMrp,
  LIMITE_EJECUCIONES_MRP,
  VENTANA_LIMITE_MRP_MS,
  verificarLimiteMrp,
} from "./limiteEjecucion";

const permitido: RateLimitResult = { allowed: true, remaining: 4, retryAfterSeconds: 0, currentCount: 1 };
const bloqueado: RateLimitResult = { allowed: false, remaining: 0, retryAfterSeconds: 42, currentCount: 5 };

describe("verificarLimiteMrp", () => {
  it("usa una clave por sucursal con el limite y la ventana configurados", () => {
    const llamadas: [string, number, number][] = [];
    verificarLimiteMrp("7", (clave, limite, ventana) => {
      llamadas.push([clave, limite, ventana]);
      return permitido;
    });
    assert.deepEqual(llamadas, [[claveLimiteMrp("7"), LIMITE_EJECUCIONES_MRP, VENTANA_LIMITE_MRP_MS]]);
    assert.notEqual(claveLimiteMrp("7"), claveLimiteMrp("8"));
  });

  it("devuelve null cuando el limite lo permite", () => {
    assert.equal(verificarLimiteMrp("7", () => permitido), null);
  });

  it("devuelve 429 con Retry-After y mensaje cuando se excede el limite", async () => {
    const r = verificarLimiteMrp("7", () => bloqueado);
    assert.ok(r);
    assert.equal(r.status, 429);
    assert.equal(r.headers.get("Retry-After"), "42");
    assert.match((await r.json()).error, /42 segundos/);
  });
});
