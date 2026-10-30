import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { altaEmpleadoAtomica, type ParametrosAlta } from "./altaEmpleado";

const params: ParametrosAlta = {
  sucursalId: BigInt(1),
  esAdministrador: false,
  rol: "Administrador",
  datos: { nombre: "Ana", correo: "ana@gmail.com", celular: null, usuario: "ana" },
  contrasenaHash: "hash",
};

type Existentes = { correo?: boolean; usuario?: boolean };

// Empty branch (bootstrap case) with configurable existing employees and create behavior.
function dbFalsa(existentes: Existentes, create: () => Promise<unknown> = async () => ({ id: BigInt(9) })) {
  const tx = {
    $queryRaw: async () => [],
    empleados: {
      count: async () => 0,
      findUnique: async ({ where }: { where: { correo?: string; usuario?: string } }) => {
        if (where.correo && existentes.correo) return { id: BigInt(1) };
        if (where.usuario && existentes.usuario) return { id: BigInt(2) };
        return null;
      },
      create,
    },
  };
  return { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } as never;
}

describe("altaEmpleadoAtomica", () => {
  it("creates the employee when correo and usuario are free", async () => {
    const r = await altaEmpleadoAtomica(dbFalsa({}), params);
    assert.equal(r.error, null);
    assert.ok(r.nuevoAdmin);
  });

  it("rejects a duplicate correo with 409", async () => {
    const r = await altaEmpleadoAtomica(dbFalsa({ correo: true }), params);
    assert.equal(r.error?.status, 409);
  });

  it("rejects a duplicate usuario with 409 instead of failing on the unique index", async () => {
    let creado = false;
    const r = await altaEmpleadoAtomica(
      dbFalsa({ usuario: true }, async () => {
        creado = true;
        return {};
      }),
      params
    );
    assert.equal(r.error?.status, 409);
    assert.match(r.error?.message ?? "", /usuario/i);
    assert.equal(creado, false);
  });

  it("maps a concurrent unique violation (P2002) to 409", async () => {
    const r = await altaEmpleadoAtomica(
      dbFalsa({}, async () => {
        throw Object.assign(new Error("Unique constraint failed"), {
          code: "P2002",
          meta: { target: "empleados_usuario_key" },
        });
      }),
      params
    );
    assert.equal(r.error?.status, 409);
  });

  it("rethrows unrelated database errors", async () => {
    await assert.rejects(
      altaEmpleadoAtomica(
        dbFalsa({}, async () => {
          throw new Error("connection lost");
        }),
        params
      ),
      /connection lost/
    );
  });
});
