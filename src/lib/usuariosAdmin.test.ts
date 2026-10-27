import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resumenUsuarios,
  estadoNormalizado,
  ROLES_EMPLEADO,
  esRolEmpleado,
  estadoEmpleadoValido,
  esCorreoGmail,
  dejaSinAdministradores,
} from "./usuariosAdmin";

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

describe("esRolEmpleado", () => {
  it("accepts only the assignable roles", () => {
    assert.equal(esRolEmpleado("Administrador"), true);
    assert.equal(esRolEmpleado("Cajero"), true);
    assert.equal(esRolEmpleado("administrador"), false);
    assert.equal(esRolEmpleado("Mesero"), false);
    assert.equal(esRolEmpleado(undefined), false);
  });
});

describe("estadoEmpleadoValido", () => {
  it("normalizes any casing of activo/inactivo", () => {
    assert.equal(estadoEmpleadoValido("activo"), "Activo");
    assert.equal(estadoEmpleadoValido("INACTIVO"), "Inactivo");
  });

  it("returns null for anything else", () => {
    assert.equal(estadoEmpleadoValido("baja"), null);
    assert.equal(estadoEmpleadoValido(""), null);
    assert.equal(estadoEmpleadoValido(1), null);
  });
});

describe("esCorreoGmail", () => {
  it("accepts gmail addresses and rejects other domains", () => {
    assert.equal(esCorreoGmail("ana.perez@gmail.com"), true);
    assert.equal(esCorreoGmail("ana@GMAIL.COM"), true);
    assert.equal(esCorreoGmail("ana@hotmail.com"), false);
    assert.equal(esCorreoGmail("ana@gmail.com.evil.io"), false);
    assert.equal(esCorreoGmail(null), false);
  });
});

describe("dejaSinAdministradores", () => {
  const admin = { rol: "Administrador", estado: "Activo" };

  it("blocks demoting the last active administrator", () => {
    assert.equal(dejaSinAdministradores(admin, { rol: "Cajero" }, 0), true);
  });

  it("blocks deactivating the last active administrator", () => {
    assert.equal(dejaSinAdministradores(admin, { estado: "Inactivo" }, 0), true);
  });

  it("allows it when another active administrator remains", () => {
    assert.equal(dejaSinAdministradores(admin, { rol: "Cajero" }, 1), false);
  });

  it("allows changes that keep the target an active administrator", () => {
    assert.equal(dejaSinAdministradores(admin, { rol: "Administrador", estado: "Activo" }, 0), false);
    assert.equal(dejaSinAdministradores(admin, {}, 0), false);
  });

  it("ignores targets that are not active administrators", () => {
    assert.equal(dejaSinAdministradores({ rol: "Cajero", estado: "Activo" }, { estado: "Inactivo" }, 0), false);
    assert.equal(dejaSinAdministradores({ rol: "Administrador", estado: "Inactivo" }, { rol: "Cajero" }, 0), false);
  });
});
