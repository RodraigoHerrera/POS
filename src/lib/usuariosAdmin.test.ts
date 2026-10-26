import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resumenUsuarios, estadoNormalizado, ROLES_EMPLEADO } from "./usuariosAdmin";

describe("resumenUsuarios", () => {
  it("returns zeros for an empty list", () => {
    assert.deepEqual(resumenUsuarios([]), { total: 0, activos: 0, administradores: 0 });
  });

  it("counts active employees regardless of case and administrators", () => {
    const empleados = [
      { estado: "Activo", rol: "Administrador" },
      { estado: "activo", rol: "Cajero" },
      { estado: "Inactivo", rol: "Administrador" },
      { estado: "Inactivo", rol: "Cajero" },
    ];
    assert.deepEqual(resumenUsuarios(empleados), { total: 4, activos: 2, administradores: 2 });
  });
});

describe("estadoNormalizado", () => {
  it("maps any casing of 'activo' to 'Activo'", () => {
    assert.equal(estadoNormalizado("activo"), "Activo");
    assert.equal(estadoNormalizado("ACTIVO"), "Activo");
  });

  it("maps anything else to 'Inactivo'", () => {
    assert.equal(estadoNormalizado("Inactivo"), "Inactivo");
    assert.equal(estadoNormalizado(""), "Inactivo");
  });
});

describe("ROLES_EMPLEADO", () => {
  it("lists the roles the system supports", () => {
    assert.deepEqual([...ROLES_EMPLEADO], ["Administrador", "Cajero"]);
  });
});
