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
      return NextResponse.redirect(new URL("/", request.url));
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
        return NextResponse.redirect(new URL("/usuarios", request.url));
      }
      console.log("✅ tokenSucursal y tokenEmpleado válidos:", {
        sucursal: validSucursal,
        empleado: validEmpleado,
      });
    } else {
      // /usuarios solo necesita tokenSucursal
      console.log("✅ tokenSucursal válido:", validSucursal);
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
