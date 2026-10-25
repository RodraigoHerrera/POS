import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // 1. Parameter parsing precedence: Query Parameter > JSON Body > Default "all"
    const url = new URL(req.url);
    const queryScope = url.searchParams.get("scope");

    let bodyScope: string | undefined;
    if (!queryScope) {
      try {
        const contentType = req.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const body = await req.json();
          if (body && typeof body.scope === "string") {
            bodyScope = body.scope;
          }
        }
      } catch {
        // Empty or non-JSON body is valid; fall through to default
      }
    }

    const rawScope = queryScope ?? bodyScope ?? "all";
    const normalizedScope = rawScope.trim().toLowerCase();

    // 2. Scope validation
    if (normalizedScope !== "empleado" && normalizedScope !== "all") {
      return NextResponse.json(
        {
          error: "Parámetro 'scope' inválido. Valores permitidos: 'empleado' | 'all'",
        },
        { status: 400 }
      );
    }

    // 3. Response object & Cookie options builder
    const response = NextResponse.json(
      {
        success: true,
        message: "Sesión cerrada correctamente",
        scope: normalizedScope,
      },
      { status: 200 }
    );

    const cookieDeletionOptions = {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "strict" as const,
      secure: process.env.NODE_ENV === "production",
    };

    // 4. Scoped cookie deletion
    response.cookies.set("tokenEmpleado", "", cookieDeletionOptions);

    if (normalizedScope === "all") {
      response.cookies.set("tokenSucursal", "", cookieDeletionOptions);
    }

    return response;
  } catch (error) {
    console.error("❌ Error en POST /api/auth/logout:", error);
    return NextResponse.json(
      {
        error: "Error interno del servidor",
        message: "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}
