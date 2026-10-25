import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  esEmpleadoActivo,
  empleadosParaKiosco,
  empleadoParaPin,
  parsearEmpleadosKiosco,
  usuarioDesdeRespuestaPin,
  puedeIniciarSesionConPin,
  rutaPinEmpleado,
  estadoSeleccionEmpleados,
  inicialesEmpleado,
  numeroTicket,
  esFotoPorDefecto,
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

describe("usuarioDesdeRespuestaPin", () => {
  it("returns the username from a valid response", () => {
    assert.equal(usuarioDesdeRespuestaPin({ usuario: "ana" }), "ana");
  });

  it("returns null for an error body, empty username or non-object", () => {
    assert.equal(usuarioDesdeRespuestaPin({ error: "Empleado no encontrado" }), null);
    assert.equal(usuarioDesdeRespuestaPin({ usuario: "" }), null);
    assert.equal(usuarioDesdeRespuestaPin(null), null);
    assert.equal(usuarioDesdeRespuestaPin("ana"), null);
  });
});

describe("puedeIniciarSesionConPin", () => {
  const activo = { sucursal_id: BigInt(1), estado: "Activo" };

  it("allows an active employee of the branch with a valid PIN", () => {
    assert.equal(puedeIniciarSesionConPin(activo, "1", true), true);
  });

  it("rejects a wrong PIN, a missing employee or another branch", () => {
    assert.equal(puedeIniciarSesionConPin(activo, "1", false), false);
    assert.equal(puedeIniciarSesionConPin(null, "1", true), false);
    assert.equal(puedeIniciarSesionConPin(activo, "2", true), false);
  });

  it("rejects an inactive employee even with the correct PIN", () => {
    // Same outcome as a wrong PIN: the response must not reveal that the PIN was right
    const inactivo = { ...activo, estado: "inactivo" };
    assert.equal(puedeIniciarSesionConPin(inactivo, "1", true), false);
    assert.equal(
      puedeIniciarSesionConPin(inactivo, "1", true),
      puedeIniciarSesionConPin(inactivo, "1", false)
    );
  });
});

describe("rutaPinEmpleado", () => {
  it("builds the PIN screen route for an employee id", () => {
    assert.equal(rutaPinEmpleado("7"), "/usuarios/pin?id=7");
  });

  it("encodes the id so it cannot inject extra query parameters", () => {
    assert.equal(rutaPinEmpleado("7&x=1"), "/usuarios/pin?id=7%26x%3D1");
  });
});

describe("estadoSeleccionEmpleados", () => {
  const ana = { id: "7", usuario: "ana", rol: "Cajero", fotoUrl: "/default-user.jpg" };

  it("is an error when the response could not be parsed", () => {
    assert.deepEqual(estadoSeleccionEmpleados(null), { tipo: "error" });
  });

  it("is empty when the branch has no active employees", () => {
    assert.deepEqual(estadoSeleccionEmpleados([]), { tipo: "vacio" });
  });

  it("is a list when there are employees", () => {
    assert.deepEqual(estadoSeleccionEmpleados([ana]), { tipo: "lista", empleados: [ana] });
  });
});

describe("inicialesEmpleado", () => {
  it("takes the first letter of the first two words", () => {
    assert.equal(inicialesEmpleado("ana perez"), "AP");
    assert.equal(inicialesEmpleado("ana.perez"), "AP");
    assert.equal(inicialesEmpleado("juan_carlos-rojas"), "JC");
  });

  it("takes the first two letters of a single word", () => {
    assert.equal(inicialesEmpleado("ana"), "AN");
    assert.equal(inicialesEmpleado("x"), "X");
  });

  it("falls back to '?' for an empty name", () => {
    assert.equal(inicialesEmpleado(""), "?");
    assert.equal(inicialesEmpleado("  ._ "), "?");
  });
});

describe("numeroTicket", () => {
  it("pads the 1-based position to two digits", () => {
    assert.equal(numeroTicket(0), "#01");
    assert.equal(numeroTicket(9), "#10");
    assert.equal(numeroTicket(122), "#123");
  });
});

describe("esFotoPorDefecto", () => {
  it("detects the placeholder photo", () => {
    assert.equal(esFotoPorDefecto("/default-user.jpg"), true);
    assert.equal(esFotoPorDefecto("/uploads/ana.jpg"), false);
  });
});
