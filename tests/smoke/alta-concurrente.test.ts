/**
 * Prueba de integración de la alta atómica de empleados: dos altas simultáneas
 * sobre una sucursal vacía y sin sesión de administrador deben dejar exactamente
 * un empleado. Solo corre contra la BD de pruebas (guard `_test`).
 *
 * Uso: npx tsx --env-file=.env --test tests/smoke/alta-concurrente.test.ts
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { resolveSmokeDatabaseUrl } from "./smokeEnv";
import { altaEmpleadoAtomica } from "../../src/lib/altaEmpleado";

const url = resolveSmokeDatabaseUrl();
const db = new PrismaClient({ datasourceUrl: url });
const sufijo = Date.now().toString(36);
let sucursalId: bigint;

function datos(n: number) {
  return {
    nombre: `Admin ${n}`,
    correo: `alta-${sufijo}-${n}@gmail.com`,
    celular: null,
    usuario: `alta_${sufijo}_${n}`,
  };
}

before(async () => {
  const s = await db.sucursales.create({
    data: {
      nombre: `Alta concurrente ${sufijo}`,
      direccion: "n/a",
      correo: `suc-${sufijo}@gmail.com`,
      telefono: "0",
      contrasena: "x",
    },
  });
  sucursalId = s.id;
});

after(async () => {
  await db.empleados.deleteMany({ where: { sucursal_id: sucursalId } });
  await db.sucursales.delete({ where: { id: sucursalId } });
  await db.$disconnect();
});

describe("altaEmpleadoAtomica", () => {
  it("lets exactly one of N simultaneous sessionless signups create the first admin", async () => {
    const resultados = await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        altaEmpleadoAtomica(db, {
          sucursalId,
          esAdministrador: false,
          rol: "Cajero",
          datos: datos(n),
          contrasenaHash: "hash",
        }),
      ),
    );

    const creados = resultados.filter((r) => !r.error);
    const rechazados = resultados.filter((r) => r.error);
    assert.equal(creados.length, 1, "solo una alta puede ser el bootstrap");
    assert.equal(rechazados.length, 4);
    assert.ok(rechazados.every((r) => r.error?.status === 403));
    assert.equal(creados[0].nuevoAdmin?.rol, "Administrador");
    assert.equal(await db.empleados.count({ where: { sucursal_id: sucursalId } }), 1);
  });
});
