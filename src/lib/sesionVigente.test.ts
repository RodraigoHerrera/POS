import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reconciliarSesion } from "./sesionVigente";

const sesion = { sucursalId: "1", empleadoId: "42", rol: "Administrador" };

describe("reconciliarSesion", () => {
  it("keeps the session when the employee is active in the same branch", () => {
    const res = reconciliarSesion(sesion, { sucursal_id: BigInt(1), rol: "Administrador", estado: "activo" });
    assert.deepEqual(res, sesion);
  });

  it("rejects the session when the employee no longer exists", () => {
    assert.equal(reconciliarSesion(sesion, null), null);
  });

  it("rejects the session when the employee was deactivated", () => {
    const res = reconciliarSesion(sesion, { sucursal_id: BigInt(1), rol: "Administrador", estado: "Inactivo" });
    assert.equal(res, null);
  });

  it("rejects the session when the employee moved to another branch", () => {
    const res = reconciliarSesion(sesion, { sucursal_id: BigInt(2), rol: "Administrador", estado: "activo" });
    assert.equal(res, null);
  });

  it("uses the current role from the database, not the one frozen in the token", () => {
    const res = reconciliarSesion(sesion, { sucursal_id: BigInt(1), rol: "Cajero", estado: "Activo" });
    assert.equal(res?.rol, "Cajero");
    assert.equal(res?.empleadoId, "42");
  });
});
