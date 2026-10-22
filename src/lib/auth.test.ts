import "dotenv/config";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import {
  obtenerSesionEmpleado,
  obtenerSesionSucursal,
  requireEmpleado,
  requireSucursal,
  esRespuestaError,
  TokenCookieReader,
} from "./auth";

const TEST_SECRET = process.env.JWT_SECRET || "142191_";

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
