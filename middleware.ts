import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

export function middleware(request: NextRequest) {
  console.log("🔥 Middleware ejecutado en:", request.nextUrl.pathname); // 👈 Agrega esto

  const token = request.cookies.get("token")?.value;
  const isProtected = request.nextUrl.pathname.startsWith("/admin");

  if (isProtected) {
    if (!token) {
      console.log("🚫 No hay token, redirigiendo al login");
      return NextResponse.redirect(new URL("/auth/signin", request.url));
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET!);
      console.log("✅ Token válido, acceso permitido");
      return NextResponse.next();
    } catch (err) {
      console.error("❌ Token inválido:", err);
      return NextResponse.redirect(new URL("/auth/signin", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
    matcher: ["/:path*"],
  };
  