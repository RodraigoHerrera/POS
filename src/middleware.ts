import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

async function verifyJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    console.error("❌ Error al verificar JWT con jose:", error);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedPaths = ["/admin", "/cajero", "/usuarios"];
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

  // 🔑 Leer ambas cookies
  const tokenSucursal = request.cookies.get("tokenSucursal")?.value;
  const tokenEmpleado = request.cookies.get("tokenEmpleado")?.value;

  if (isProtected) {
    // Siempre requerimos tokenSucursal al menos
    if (!tokenSucursal) {
      console.log("🚫 No hay tokenSucursal");
      return NextResponse.redirect(new URL("/", request.url));
    }
    const validSucursal = await verifyJWT(tokenSucursal);
    if (!validSucursal) {
      console.log("🚫 tokenSucursal inválido o expirado");
      const redirectRes = NextResponse.redirect(new URL("/", request.url));
      redirectRes.cookies.set("tokenSucursal", "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "strict" });
      redirectRes.cookies.set("tokenEmpleado", "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "strict" });
      return redirectRes;
    }

    // /admin y /cajero requieren también tokenEmpleado
    const requiereEmpleado = pathname.startsWith("/admin") || pathname.startsWith("/cajero");

    if (requiereEmpleado) {
      if (!tokenEmpleado) {
        console.log("🚫 No hay tokenEmpleado");
        // Redirige a selección de empleado (ajusta ruta si usas otra)
        return NextResponse.redirect(new URL("/usuarios", request.url));
      }
      const validEmpleado = await verifyJWT(tokenEmpleado);
      if (!validEmpleado) {
        console.log("🚫 tokenEmpleado inválido o expirado");
        const redirectRes = NextResponse.redirect(new URL("/usuarios", request.url));
        redirectRes.cookies.set("tokenEmpleado", "", {
          path: "/",
          maxAge: 0,
          httpOnly: true,
          sameSite: "strict",
        });
        return redirectRes;
      }

      // Validar concordancia de sucursalId entre tokenSucursal y tokenEmpleado (SEC-01: Cross-Tenant check)
      const sucursalId = (validSucursal as any)?.sucursalId || (validSucursal as any)?.id;
      const empleadoSucursalId = (validEmpleado as any)?.sucursalId;

      if (
        !empleadoSucursalId ||
        !sucursalId ||
        (typeof sucursalId !== "string" && typeof sucursalId !== "number") ||
        (typeof empleadoSucursalId !== "string" && typeof empleadoSucursalId !== "number") ||
        String(empleadoSucursalId) !== String(sucursalId)
      ) {
        console.log("🚫 Desincronización detectada: tokenEmpleado no pertenece a la sucursal activa");
        const redirectRes = NextResponse.redirect(new URL("/usuarios", request.url));
        redirectRes.cookies.set("tokenEmpleado", "", {
          path: "/",
          maxAge: 0,
          httpOnly: true,
          sameSite: "strict",
        });
        return redirectRes;
      }

      // /admin es exclusivo de Administrador. /cajero acepta ambos roles
      // (un administrador también puede operar la caja).
      const rol = (validEmpleado as any)?.rol;
      if (pathname.startsWith("/admin") && rol !== "Administrador") {
        console.log(`🚫 Rol "${rol}" sin acceso a /admin`);
        return NextResponse.redirect(new URL("/cajero", request.url));
      }

      console.log("✅ tokenSucursal y tokenEmpleado válidos:", {
        sucursal: validSucursal,
        empleado: validEmpleado,
      });
    } else {
      // /usuarios solo necesita tokenSucursal
      console.log("✅ tokenSucursal válido:", validSucursal);

      // Si el cliente envía un tokenEmpleado desincronizado o inválido, lo purgamos de inmediato
      if (tokenEmpleado) {
        const validEmpleado = await verifyJWT(tokenEmpleado);
        const sucursalId = (validSucursal as any)?.sucursalId || (validSucursal as any)?.id;
        const empleadoSucursalId = (validEmpleado as any)?.sucursalId;

        if (
          !validEmpleado ||
          !empleadoSucursalId ||
          !sucursalId ||
          (typeof sucursalId !== "string" && typeof sucursalId !== "number") ||
          (typeof empleadoSucursalId !== "string" && typeof empleadoSucursalId !== "number") ||
          String(empleadoSucursalId) !== String(sucursalId)
        ) {
          console.log("🧹 Purgando tokenEmpleado desincronizado o inválido en /usuarios");
          const res = NextResponse.next();
          res.cookies.set("tokenEmpleado", "", {
            path: "/",
            maxAge: 0,
            httpOnly: true,
            sameSite: "strict",
          });
          return res;
        }
      }
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/admin",
    "/cajero/:path*",
    "/cajero",
    "/usuarios/:path*",
    "/usuarios",
  ],
};
