import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  esEmpleadoActivo,
  empleadosParaKiosco,
  empleadoParaPin,
  parsearEmpleadosKiosco,
} from "./empleadosKiosco";

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

describe("empleadoParaPin", () => {
  it("exposes only the username of an active employee", () => {
    assert.deepEqual(empleadoParaPin(base), { usuario: "ana" });
  });

  it("returns null for an inactive or missing employee", () => {
    assert.equal(empleadoParaPin({ ...base, estado: "inactivo" }), null);
    assert.equal(empleadoParaPin(null), null);
  });
});

describe("parsearEmpleadosKiosco", () => {
  const valido = { id: "7", usuario: "ana", rol: "Cajero", fotoUrl: "/default-user.jpg" };

  it("returns the list when the response is a valid array", () => {
    assert.deepEqual(parsearEmpleadosKiosco([valido]), [valido]);
    assert.deepEqual(parsearEmpleadosKiosco([]), []);
  });

  it("returns null for an error body or a non-array payload", () => {
    assert.equal(parsearEmpleadosKiosco({ message: "No autorizado" }), null);
    assert.equal(parsearEmpleadosKiosco(null), null);
    assert.equal(parsearEmpleadosKiosco("texto"), null);
  });

  it("returns null when an item is malformed", () => {
    assert.equal(parsearEmpleadosKiosco([valido, { id: 1 }]), null);
  });
});
