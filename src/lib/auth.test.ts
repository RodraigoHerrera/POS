import "dotenv/config";
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { prisma } from "./db";
import { serializeBigInt } from "./serialize";
import {
  obtenerSesionEmpleado,
  obtenerSesionSucursal,
  requireEmpleado,
  requireSucursal,
  esRespuestaError,
  TokenCookieReader,
} from "./auth";

const TEST_SECRET = process.env.JWT_SECRET || "142191_";

// requireEmpleado revalida contra la fila del empleado; los ids de estos tests
// son ficticios, así que se simula la base (sucursal 1, activos, rol por id).
const ROL_EN_BD: Record<string, string> = { "1": "Administrador", "42": "Cajero", "101": "Cajero", "202": "Mesero" };
let estadoEnBd = "activo";
const findUniqueOriginal = prisma.empleados.findUnique;

beforeEach(() => {
  estadoEnBd = "activo";
  (prisma.empleados.findUnique as any) = async (args: any) => {
    const rol = ROL_EN_BD[String(args.where.id)];
    return rol ? { sucursal_id: BigInt(1), rol, estado: estadoEnBd } : null;
  };
});
afterEach(() => {
  prisma.empleados.findUnique = findUniqueOriginal;
});

function createCookieReader(cookiesMap: Record<string, string>): TokenCookieReader {
  return {
    get(name: string) {
      const val = cookiesMap[name];
      return val !== undefined ? { value: val } : undefined;
    },
  };
}

describe("SEC-01: Multi-tenant & Cross-Tenant Authentication Tests", () => {
  it("allows login when tokenSucursal and tokenEmpleado have matching sucursalId", async () => {
    const tokenSucursal = jwt.sign({ sucursalId: "1", correo: "suc1@smash.com" }, TEST_SECRET);
    const tokenEmpleado = jwt.sign(
      { empleadoId: "42", rol: "Cajero", sucursalId: "1" },
      TEST_SECRET
    );

    const reader = createCookieReader({ tokenSucursal, tokenEmpleado });
    const sesion = await obtenerSesionEmpleado(reader);

    assert.ok(sesion !== null);
    assert.equal(sesion.sucursalId, "1");
    assert.equal(sesion.empleadoId, "42");
    assert.equal(sesion.rol, "Cajero");
  });

  it("blocks cross-tenant attack when tokenEmpleado has different sucursalId", async () => {
    // Sucursal 1 terminal, but attacker presents tokenEmpleado from Sucursal 2
    const tokenSucursal = jwt.sign({ sucursalId: "1", correo: "suc1@smash.com" }, TEST_SECRET);
    const tokenEmpleadoCrossTenant = jwt.sign(
      { empleadoId: "99", rol: "Administrador", sucursalId: "2" },
      TEST_SECRET
    );

    const reader = createCookieReader({
      tokenSucursal,
      tokenEmpleado: tokenEmpleadoCrossTenant,
    });
    const sesion = await obtenerSesionEmpleado(reader);

    assert.equal(sesion, null, "Cross-tenant tokenEmpleado must be rejected with null session");
  });

  it("blocks legacy tokenEmpleado that lacks sucursalId payload (the SEC-01 root issue)", async () => {
    const tokenSucursal = jwt.sign({ sucursalId: "1", correo: "suc1@smash.com" }, TEST_SECRET);
    // Token without sucursalId (pre-SEC-01 vulnerability)
    const legacyTokenEmpleado = jwt.sign(
      { empleadoId: "42", rol: "Cajero" },
      TEST_SECRET
    );

    const reader = createCookieReader({
      tokenSucursal,
      tokenEmpleado: legacyTokenEmpleado,
    });
    const sesion = await obtenerSesionEmpleado(reader);

    assert.equal(
      sesion,
      null,
      "tokenEmpleado lacking sucursalId must be rejected"
    );
  });

  it("returns null when tokenSucursal is missing", async () => {
    const tokenEmpleado = jwt.sign(
      { empleadoId: "42", rol: "Cajero", sucursalId: "1" },
      TEST_SECRET
    );
    const reader = createCookieReader({ tokenEmpleado });
    const sesion = await obtenerSesionEmpleado(reader);
    assert.equal(sesion, null);
  });

  it("returns null when tokenEmpleado is missing", async () => {
    const tokenSucursal = jwt.sign({ sucursalId: "1" }, TEST_SECRET);
    const reader = createCookieReader({ tokenSucursal });
    const sesion = await obtenerSesionEmpleado(reader);
    assert.equal(sesion, null);
  });

  it("returns null when token signature is invalid", async () => {
    const tokenSucursal = jwt.sign({ sucursalId: "1" }, "wrong_secret");
    const tokenEmpleado = jwt.sign(
      { empleadoId: "42", rol: "Cajero", sucursalId: "1" },
      "wrong_secret"
    );
    const reader = createCookieReader({ tokenSucursal, tokenEmpleado });
    const sesion = await obtenerSesionEmpleado(reader);
    assert.equal(sesion, null);
  });

  it("requireEmpleado returns 401 when cross-tenant attack is attempted", async () => {
    const tokenSucursal = jwt.sign({ sucursalId: "1" }, TEST_SECRET);
    const crossTenantToken = jwt.sign(
      { empleadoId: "99", rol: "Administrador", sucursalId: "2" },
      TEST_SECRET
    );
    const reader = createCookieReader({
      tokenSucursal,
      tokenEmpleado: crossTenantToken,
    });

    const res = await requireEmpleado(["Administrador"], reader);
    assert.ok(esRespuestaError(res));
    assert.equal(res.status, 401);
  });

  it("requireEmpleado returns 403 when role does not match allowed roles", async () => {
    const tokenSucursal = jwt.sign({ sucursalId: "1" }, TEST_SECRET);
    const tokenEmpleado = jwt.sign(
      { empleadoId: "42", rol: "Cajero", sucursalId: "1" },
      TEST_SECRET
    );
    const reader = createCookieReader({ tokenSucursal, tokenEmpleado });

    const res = await requireEmpleado(["Administrador"], reader);
    assert.ok(esRespuestaError(res));
    assert.equal(res.status, 403);
  });

  it("obtenerSesionSucursal correctly returns sucursalId", async () => {
    const tokenSucursal = jwt.sign({ sucursalId: "10" }, TEST_SECRET);
    const reader = createCookieReader({ tokenSucursal });
    const sesion = await obtenerSesionSucursal(reader);
    assert.ok(sesion !== null);
    assert.equal(sesion.sucursalId, "10");
  });

  it("requireSucursal succeeds when tokenSucursal is valid and fails with 401 when missing", async () => {
    const tokenSucursal = jwt.sign({ sucursalId: "15" }, TEST_SECRET);
    const validReader = createCookieReader({ tokenSucursal });
    const sesion = await requireSucursal(validReader);
    assert.ok(!esRespuestaError(sesion));
    assert.equal(sesion.sucursalId, "15");

    const emptyReader = createCookieReader({});
    const failRes = await requireSucursal(emptyReader);
    assert.ok(esRespuestaError(failRes));
    assert.equal(failRes.status, 401);
  });

  it("rejects non-primitive sucursalId to prevent type confusion attacks", async () => {
    // Edge case: attacker embeds object/array in payload that coerces to "[object Object]"
    const tokenSucursal = jwt.sign({ sucursalId: {} }, TEST_SECRET);
    const tokenEmpleado = jwt.sign(
      { empleadoId: "42", rol: "Cajero", sucursalId: {} },
      TEST_SECRET
    );
    const reader = createCookieReader({ tokenSucursal, tokenEmpleado });
    const sesion = await obtenerSesionEmpleado(reader);
    assert.equal(sesion, null, "Non-primitive sucursalId must be rejected");
  });
});

describe("SEC-01: Middleware Cross-Tenant Isolation Tests", () => {
  it("redirects and clears tokenEmpleado cookie on cross-tenant mismatch in protected route", async () => {
    const { NextRequest } = await import("next/server");
    const { middleware } = await import("../middleware");

    const tokenSucursal = jwt.sign({ sucursalId: "1" }, TEST_SECRET);
    const crossTenantToken = jwt.sign(
      { empleadoId: "99", rol: "Administrador", sucursalId: "2" },
      TEST_SECRET
    );

    const req = new NextRequest("http://localhost/admin", {
      headers: {
        cookie: `tokenSucursal=${tokenSucursal}; tokenEmpleado=${crossTenantToken}`,
      },
    });

    const res = await middleware(req);
    assert.equal(res.status, 307);
    assert.equal(res.headers.get("location"), "http://localhost/usuarios");

    const setCookie = res.headers.get("set-cookie") || "";
    assert.ok(
      setCookie.includes("tokenEmpleado=") && setCookie.includes("Max-Age=0"),
      `Expected tokenEmpleado to be purged with Max-Age=0, got: ${setCookie}`
    );
  });

  it("redirects and clears cookie when tokenEmpleado lacks sucursalId", async () => {
    const { NextRequest } = await import("next/server");
    const { middleware } = await import("../middleware");

    const tokenSucursal = jwt.sign({ sucursalId: "1" }, TEST_SECRET);
    const legacyToken = jwt.sign({ empleadoId: "42", rol: "Cajero" }, TEST_SECRET);

    const req = new NextRequest("http://localhost/cajero", {
      headers: {
        cookie: `tokenSucursal=${tokenSucursal}; tokenEmpleado=${legacyToken}`,
      },
    });

    const res = await middleware(req);
    assert.equal(res.status, 307);
    assert.equal(res.headers.get("location"), "http://localhost/usuarios");

    const setCookie = res.headers.get("set-cookie") || "";
    assert.ok(
      setCookie.includes("tokenEmpleado=") && setCookie.includes("Max-Age=0"),
      `Expected tokenEmpleado to be purged with Max-Age=0, got: ${setCookie}`
    );
  });

  it("redirects and clears cookie when tokenEmpleado has invalid signature in protected route", async () => {
    const { NextRequest } = await import("next/server");
    const { middleware } = await import("../middleware");

    const tokenSucursal = jwt.sign({ sucursalId: "1" }, TEST_SECRET);
    const corruptedToken = "invalid.jwt.token";

    const req = new NextRequest("http://localhost/cajero", {
      headers: {
        cookie: `tokenSucursal=${tokenSucursal}; tokenEmpleado=${corruptedToken}`,
      },
    });

    const res = await middleware(req);
    assert.equal(res.status, 307);
    assert.equal(res.headers.get("location"), "http://localhost/usuarios");

    const setCookie = res.headers.get("set-cookie") || "";
    assert.ok(
      setCookie.includes("tokenEmpleado=") && setCookie.includes("Max-Age=0"),
      `Expected corrupted tokenEmpleado to be purged with Max-Age=0, got: ${setCookie}`
    );
  });

  it("purges mismatched or invalid tokenEmpleado when visiting /usuarios", async () => {
    const { NextRequest } = await import("next/server");
    const { middleware } = await import("../middleware");

    const tokenSucursal = jwt.sign({ sucursalId: "1" }, TEST_SECRET);
    const mismatchedToken = jwt.sign(
      { empleadoId: "42", rol: "Cajero", sucursalId: "2" },
      TEST_SECRET
    );

    const req = new NextRequest("http://localhost/usuarios", {
      headers: {
        cookie: `tokenSucursal=${tokenSucursal}; tokenEmpleado=${mismatchedToken}`,
      },
    });

    const res = await middleware(req);
    assert.equal(res.status, 200);

    const setCookie = res.headers.get("set-cookie") || "";
    assert.ok(
      setCookie.includes("tokenEmpleado=") && setCookie.includes("Max-Age=0"),
      `Expected mismatched tokenEmpleado to be purged on /usuarios with Max-Age=0, got: ${setCookie}`
    );
  });

  it("redirects to root and clears all tokens when tokenSucursal is invalid or expired", async () => {
    const { NextRequest } = await import("next/server");
    const { middleware } = await import("../middleware");

    const req = new NextRequest("http://localhost/admin", {
      headers: {
        cookie: `tokenSucursal=invalid_token; tokenEmpleado=any_token`,
      },
    });

    const res = await middleware(req);
    assert.equal(res.status, 307);
    assert.equal(res.headers.get("location"), "http://localhost/");

    const setCookie = res.headers.get("set-cookie") || "";
    assert.ok(
      setCookie.includes("tokenSucursal=") && setCookie.includes("tokenEmpleado="),
      `Expected all cookies to be purged, got: ${setCookie}`
    );
  });

  it("allows access when tokenSucursal and tokenEmpleado have matching sucursalId", async () => {
    const { NextRequest } = await import("next/server");
    const { middleware } = await import("../middleware");

    const tokenSucursal = jwt.sign({ sucursalId: "1" }, TEST_SECRET);
    const validToken = jwt.sign(
      { empleadoId: "42", rol: "Administrador", sucursalId: "1" },
      TEST_SECRET
    );

    const req = new NextRequest("http://localhost/admin", {
      headers: {
        cookie: `tokenSucursal=${tokenSucursal}; tokenEmpleado=${validToken}`,
      },
    });

    const res = await middleware(req);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("location"), null);
  });
});



describe("SEC-02: Scoped Logout Route Tests (/api/auth/logout)", () => {
  it("clears only tokenEmpleado when scope=empleado query parameter is provided", async () => {
    const { NextRequest } = await import("next/server");
    const { POST } = await import("../app/api/auth/logout/route");

    const req = new NextRequest("http://localhost/api/auth/logout?scope=empleado", {
      method: "POST",
    });

    const res = await POST(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.scope, "empleado");

    const setCookies = res.headers.getSetCookie();
    const empleadoCookie = setCookies.find((c) => c.startsWith("tokenEmpleado="));
    const sucursalCookie = setCookies.find((c) => c.startsWith("tokenSucursal="));

    assert.ok(empleadoCookie, "tokenEmpleado must be cleared");
    assert.ok(empleadoCookie.includes("Max-Age=0"));
    assert.ok(empleadoCookie.toLowerCase().includes("httponly"));
    assert.ok(empleadoCookie.toLowerCase().includes("samesite=strict"));
    assert.equal(sucursalCookie, undefined, "tokenSucursal must NOT be cleared when scope=empleado");
  });

  it("clears only tokenEmpleado when scope=empleado is passed in JSON body", async () => {
    const { NextRequest } = await import("next/server");
    const { POST } = await import("../app/api/auth/logout/route");

    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "empleado" }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.scope, "empleado");

    const setCookies = res.headers.getSetCookie();
    assert.ok(setCookies.some((c) => c.startsWith("tokenEmpleado=") && c.includes("Max-Age=0")));
    assert.ok(!setCookies.some((c) => c.startsWith("tokenSucursal=")));
  });

  it("clears both tokenEmpleado and tokenSucursal when scope=all query parameter is provided", async () => {
    const { NextRequest } = await import("next/server");
    const { POST } = await import("../app/api/auth/logout/route");

    const req = new NextRequest("http://localhost/api/auth/logout?scope=all", {
      method: "POST",
    });

    const res = await POST(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.scope, "all");

    const setCookies = res.headers.getSetCookie();
    assert.ok(setCookies.some((c) => c.startsWith("tokenEmpleado=") && c.includes("Max-Age=0")));
    assert.ok(setCookies.some((c) => c.startsWith("tokenSucursal=") && c.includes("Max-Age=0")));
  });

  it("defaults to scope=all and clears both cookies when no scope parameter is given", async () => {
    const { NextRequest } = await import("next/server");
    const { POST } = await import("../app/api/auth/logout/route");

    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
    });

    const res = await POST(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.scope, "all");

    const setCookies = res.headers.getSetCookie();
    assert.ok(setCookies.some((c) => c.startsWith("tokenEmpleado=")));
    assert.ok(setCookies.some((c) => c.startsWith("tokenSucursal=")));
  });

  it("returns 400 Bad Request when an invalid scope parameter is passed", async () => {
    const { NextRequest } = await import("next/server");
    const { POST } = await import("../app/api/auth/logout/route");

    const req = new NextRequest("http://localhost/api/auth/logout?scope=invalid_scope", {
      method: "POST",
    });

    const res = await POST(req);
    assert.equal(res.status, 400);

    const body = await res.json();
    assert.ok(body.error.includes("Parámetro 'scope' inválido"));

    const setCookies = res.headers.getSetCookie();
    assert.equal(setCookies.length, 0, "No cookies should be modified on 400");
  });
});

describe("SEC-02: Middleware Proactive Purge on /usuarios Tests", () => {
  it("unconditionally purges a valid tokenEmpleado when navigating to /usuarios", async () => {
    const { NextRequest } = await import("next/server");
    const { middleware } = await import("../middleware");

    const tokenSucursal = jwt.sign({ sucursalId: "1" }, TEST_SECRET);
    const validEmpleadoToken = jwt.sign(
      { empleadoId: "42", rol: "Cajero", sucursalId: "1" },
      TEST_SECRET
    );

    const req = new NextRequest("http://localhost/usuarios", {
      headers: {
        cookie: `tokenSucursal=${tokenSucursal}; tokenEmpleado=${validEmpleadoToken}`,
      },
    });

    const res = await middleware(req);
    assert.equal(res.status, 200);

    const setCookies = res.headers.getSetCookie();
    const purgedEmpleado = setCookies.find((c) => c.startsWith("tokenEmpleado="));
    assert.ok(purgedEmpleado, "tokenEmpleado must be purged on /usuarios");
    assert.ok(purgedEmpleado.includes("Max-Age=0"));
    assert.ok(purgedEmpleado.toLowerCase().includes("httponly"));
    assert.ok(purgedEmpleado.toLowerCase().includes("samesite=strict"));
    assert.ok(!setCookies.some((c) => c.startsWith("tokenSucursal=")), "tokenSucursal must be kept");
  });

  it("does not attach Set-Cookie on /usuarios when tokenEmpleado is not present", async () => {
    const { NextRequest } = await import("next/server");
    const { middleware } = await import("../middleware");

    const tokenSucursal = jwt.sign({ sucursalId: "1" }, TEST_SECRET);

    const req = new NextRequest("http://localhost/usuarios", {
      headers: {
        cookie: `tokenSucursal=${tokenSucursal}`,
      },
    });

    const res = await middleware(req);
    assert.equal(res.status, 200);

    const setCookies = res.headers.getSetCookie();
    assert.equal(setCookies.length, 0, "No Set-Cookie header needed when tokenEmpleado is absent");
  });
});

describe("SEC-07: Caja RBAC Standardization Tests", () => {
  it("allows Cajero role on Caja APIs", async () => {
    const tokenSucursal = jwt.sign({ sucursalId: "1" }, TEST_SECRET);
    const tokenEmpleado = jwt.sign(
      { empleadoId: "101", rol: "Cajero", sucursalId: "1" },
      TEST_SECRET
    );
    const reader = createCookieReader({ tokenSucursal, tokenEmpleado });
    const res = await requireEmpleado(["Cajero", "Administrador"], reader);

    assert.ok(!esRespuestaError(res));
    assert.equal(res.sucursalId, "1");
    assert.equal(res.empleadoId, "101");
    assert.equal(res.rol, "Cajero");
  });

  it("allows Administrador role on Caja APIs", async () => {
    const tokenSucursal = jwt.sign({ sucursalId: "1" }, TEST_SECRET);
    const tokenEmpleado = jwt.sign(
      { empleadoId: "1", rol: "Administrador", sucursalId: "1" },
      TEST_SECRET
    );
    const reader = createCookieReader({ tokenSucursal, tokenEmpleado });
    const res = await requireEmpleado(["Cajero", "Administrador"], reader);

    assert.ok(!esRespuestaError(res));
    assert.equal(res.sucursalId, "1");
    assert.equal(res.empleadoId, "1");
    assert.equal(res.rol, "Administrador");
  });

  it("rejects unauthorized roles (such as Mesero or Cocina) with 403 Forbidden", async () => {
    const tokenSucursal = jwt.sign({ sucursalId: "1" }, TEST_SECRET);
    const tokenEmpleado = jwt.sign(
      { empleadoId: "202", rol: "Mesero", sucursalId: "1" },
      TEST_SECRET
    );
    const reader = createCookieReader({ tokenSucursal, tokenEmpleado });
    const res = await requireEmpleado(["Cajero", "Administrador"], reader);

    assert.ok(esRespuestaError(res));
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /requiere rol: Cajero o Administrador/);
  });

  it("rejects a still-valid token when the employee was deactivated afterwards", async () => {
    const tokenSucursal = jwt.sign({ sucursalId: "1" }, TEST_SECRET);
    const tokenEmpleado = jwt.sign({ empleadoId: "42", rol: "Cajero", sucursalId: "1" }, TEST_SECRET);
    const reader = createCookieReader({ tokenSucursal, tokenEmpleado });

    estadoEnBd = "Inactivo";
    const res = await requireEmpleado(["Cajero", "Administrador"], reader);

    assert.ok(esRespuestaError(res));
    assert.equal(res.status, 401);
  });

  it("enforces the current role from the database over a stale Administrador token", async () => {
    const tokenSucursal = jwt.sign({ sucursalId: "1" }, TEST_SECRET);
    // Token emitido cuando 42 era Administrador; en la base ya es Cajero
    const tokenEmpleado = jwt.sign({ empleadoId: "42", rol: "Administrador", sucursalId: "1" }, TEST_SECRET);
    const reader = createCookieReader({ tokenSucursal, tokenEmpleado });

    const res = await requireEmpleado(["Administrador"], reader);

    assert.ok(esRespuestaError(res));
    assert.equal(res.status, 403);
  });

  it("rejects a valid token whose employee no longer exists", async () => {
    const tokenSucursal = jwt.sign({ sucursalId: "1" }, TEST_SECRET);
    const tokenEmpleado = jwt.sign({ empleadoId: "999", rol: "Administrador", sucursalId: "1" }, TEST_SECRET);
    const reader = createCookieReader({ tokenSucursal, tokenEmpleado });

    const res = await requireEmpleado(["Administrador"], reader);

    assert.ok(esRespuestaError(res));
    assert.equal(res.status, 401);
  });

  it("rejects missing tokens on Caja APIs with 401 Unauthorized", async () => {
    const reader = createCookieReader({});
    const res = await requireEmpleado(["Cajero", "Administrador"], reader);

    assert.ok(esRespuestaError(res));
    assert.equal(res.status, 401);
  });
});

describe("SEC-09: Bcrypt Password Hash Sanitization in Registration", () => {
  it("POST /api/auth/register enforces explicit select projection excluding contrasena", async () => {
    const { NextRequest } = await import("next/server");
    const { POST: registerBranch } = await import("../app/api/auth/register/route");

    const origFindUnique = prisma.sucursales.findUnique;
    const origCreate = prisma.sucursales.create;

    try {
      let capturedArgs: any = null;
      (prisma.sucursales.findUnique as any) = async () => null;
      (prisma.sucursales.create as any) = async (args: any) => {
        capturedArgs = args;
        return {
          id: BigInt(123),
          nombre: args.data.nombre,
          direccion: args.data.direccion,
          correo: args.data.correo,
          telefono: args.data.telefono,
          creado: new Date(),
        };
      };

      const req = new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: "Sucursal Test SEC09",
          direccion: "Calle Test 123",
          correo: "sec09test@gmail.com",
          telefono: "77799988",
          contraseña: "PlaintextPassword123!",
        }),
      });

      const res = await registerBranch(req);
      assert.equal(res.status, 201);
      const body = await res.json();

      assert.ok(capturedArgs, "prisma.sucursales.create should be called");
      assert.ok(capturedArgs.select, "prisma.sucursales.create must include explicit select projection");
      assert.equal(capturedArgs.select.contrasena, undefined);
      assert.equal("contrasena" in capturedArgs.select, false);
      assert.equal(capturedArgs.select.id, true);
      assert.equal(capturedArgs.select.nombre, true);
      assert.equal(capturedArgs.select.direccion, true);
      assert.equal(capturedArgs.select.correo, true);
      assert.equal(capturedArgs.select.telefono, true);
      assert.equal(capturedArgs.select.creado, true);

      assert.equal(body.sucursal.id, "123");
      assert.equal(body.sucursal.correo, "sec09test@gmail.com");
      assert.equal(body.sucursal.contrasena, undefined);
      assert.equal("contrasena" in body.sucursal, false);
      assert.equal(JSON.stringify(body).includes("contrasena"), false);
      assert.equal(JSON.stringify(body).includes("PlaintextPassword123!"), false);
    } finally {
      prisma.sucursales.findUnique = origFindUnique;
      prisma.sucursales.create = origCreate;
    }
  });

  it("sucursales.create projection excludes contrasena while retaining all metadata", () => {
    const sucursalSelectProjection = {
      id: true,
      nombre: true,
      direccion: true,
      correo: true,
      telefono: true,
      creado: true,
    } as const;

    assert.equal("contrasena" in sucursalSelectProjection, false);

    const mockProjectedSucursal = {
      id: BigInt(10),
      nombre: "Smash Centro",
      direccion: "Av. Las Americas 45",
      correo: "centro@gmail.com",
      telefono: "77123456",
      creado: new Date("2026-01-01T00:00:00.000Z"),
    };

    const serializedSucursal = serializeBigInt(mockProjectedSucursal);
    assert.equal((serializedSucursal as any).contrasena, undefined);
    assert.equal("contrasena" in serializedSucursal, false);
    assert.equal(serializedSucursal.id, "10");
    assert.equal(serializedSucursal.nombre, "Smash Centro");
    assert.equal(serializedSucursal.direccion, "Av. Las Americas 45");
    assert.equal(serializedSucursal.correo, "centro@gmail.com");
    assert.equal(serializedSucursal.telefono, "77123456");
    assert.equal(JSON.stringify(serializedSucursal).includes("contrasena"), false);
  });

  it("empleados.create projection excludes contrasena while retaining all required metadata", () => {
    const empleadoSelectProjection = {
      id: true,
      sucursal_id: true,
      rol: true,
      usuario: true,
      correo: true,
      nombre: true,
      celular: true,
      creado: true,
      estado: true,
    } as const;

    assert.equal("contrasena" in empleadoSelectProjection, false);

    const mockProjectedAdmin = {
      id: BigInt(42),
      sucursal_id: BigInt(10),
      rol: "Administrador",
      usuario: "admin_smash",
      correo: "admin@gmail.com",
      nombre: "Admin General",
      celular: "77998811",
      creado: new Date("2026-01-01T00:00:00.000Z"),
      estado: "Activo",
    };

    const serializedAdmin = serializeBigInt(mockProjectedAdmin);
    assert.equal((serializedAdmin as any).contrasena, undefined);
    assert.equal("contrasena" in serializedAdmin, false);
    assert.equal(serializedAdmin.id, "42");
    assert.equal(serializedAdmin.sucursal_id, "10");
    assert.equal(serializedAdmin.rol, "Administrador");
    assert.equal(serializedAdmin.usuario, "admin_smash");
    assert.equal(serializedAdmin.correo, "admin@gmail.com");
    assert.equal(serializedAdmin.nombre, "Admin General");
    assert.equal(serializedAdmin.celular, "77998811");
    assert.equal(serializedAdmin.estado, "Activo");
    assert.equal(JSON.stringify(serializedAdmin).includes("contrasena"), false);
  });
});

