import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { destinoTrasApertura } from "./aperturaCaja";

describe("destinoTrasApertura", () => {
  it("continues to sales after a successful opening", () => {
    assert.equal(destinoTrasApertura(201), "ventas");
  });

  it("continues to sales when the employee already has an open register", () => {
    assert.equal(destinoTrasApertura(409), "ventas");
  });

  it("reports an error for validation, auth and server failures", () => {
    for (const status of [400, 401, 403, 500]) {
      assert.equal(destinoTrasApertura(status), "error");
    }
  });
});
