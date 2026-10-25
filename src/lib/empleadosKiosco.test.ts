import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { esEmpleadoActivo, empleadosParaKiosco } from "./empleadosKiosco";

const base = {
  id: BigInt(7),
  nombre: "Ana Pérez",
  usuario: "ana",
  rol: "Cajero",
  estado: "activo",
  correo: "ana@correo.com",
  celular: "70000000",
  creado: new Date("2026-01-01"),
};

describe("esEmpleadoActivo", () => {
  it("accepts 'activo' regardless of case", () => {
    assert.equal(esEmpleadoActivo("activo"), true);
    assert.equal(esEmpleadoActivo("Activo"), true);
    assert.equal(esEmpleadoActivo("ACTIVO"), true);
  });

  it("rejects any other state, null or undefined", () => {
    assert.equal(esEmpleadoActivo("inactivo"), false);
    assert.equal(esEmpleadoActivo(""), false);
    assert.equal(esEmpleadoActivo(null), false);
    assert.equal(esEmpleadoActivo(undefined), false);
  });
});

describe("empleadosParaKiosco", () => {
  it("exposes only id, usuario, rol and fotoUrl", () => {
    const [empleado] = empleadosParaKiosco([base]);
    assert.deepEqual(empleado, {
      id: "7",
      usuario: "ana",
      rol: "Cajero",
      fotoUrl: "/default-user.jpg",
    });
  });

  it("never leaks contact data or creation date", () => {
    const [empleado] = empleadosParaKiosco([base]);
    for (const campo of ["nombre", "correo", "celular", "creado", "estado", "contrasena"]) {
      assert.equal(campo in empleado, false, `leaked field: ${campo}`);
    }
  });

  it("drops inactive employees", () => {
    const resultado = empleadosParaKiosco([
      base,
      { ...base, id: BigInt(8), usuario: "beto", estado: "inactivo" },
      { ...base, id: BigInt(9), usuario: "caro", estado: null },
    ]);
    assert.deepEqual(
      resultado.map((e) => e.usuario),
      ["ana"]
    );
  });
});
