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
  const token = request.cookies.get("token")?.value;
  const isProtected = request.nextUrl.pathname.startsWith("/admin");

  if (isProtected) {
    if (!token) {
      console.log("🚫 No hay token");
      return NextResponse.redirect(new URL("/", request.url));
    }

    const valid = await verifyJWT(token);
    if (!valid) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    console.log("✅ Token válido:", valid);
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/admin"],
};
