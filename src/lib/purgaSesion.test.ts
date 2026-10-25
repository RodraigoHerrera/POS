import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { debePurgarEmpleado } from "./purgaSesion";

const sinHeaders = new Headers();

describe("debePurgarEmpleado", () => {
  it("purges on a real navigation to the employee selection page", () => {
    assert.equal(debePurgarEmpleado("/usuarios", sinHeaders), true);
    assert.equal(debePurgarEmpleado("/usuarios/", sinHeaders), true);
    // Navegación del cliente (RSC) sin prefetch también es una navegación real
    assert.equal(debePurgarEmpleado("/usuarios", new Headers({ RSC: "1" })), true);
  });

  it("does not purge on sub-routes or assets under /usuarios", () => {
    assert.equal(debePurgarEmpleado("/usuarios/pin", sinHeaders), false);
    assert.equal(debePurgarEmpleado("/usuarios/images/logo/logo-kumo-dark.svg", sinHeaders), false);
  });

  it("does not purge on prefetch requests", () => {
    assert.equal(debePurgarEmpleado("/usuarios", new Headers({ "Next-Router-Prefetch": "1", RSC: "1" })), false);
    assert.equal(debePurgarEmpleado("/usuarios", new Headers({ Purpose: "prefetch" })), false);
    assert.equal(debePurgarEmpleado("/usuarios", new Headers({ "Sec-Purpose": "prefetch;prerender" })), false);
  });
});
