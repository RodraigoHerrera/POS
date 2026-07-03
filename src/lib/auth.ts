import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { NextResponse } from "next/server";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export interface SesionSucursal {
  sucursalId: string;
}

export interface SesionEmpleado extends SesionSucursal {
  empleadoId: string;
  rol: string;
}

/** Verifica solo la sesión de sucursal (sin empleado). Usado en /usuarios pre-PIN. */
export async function obtenerSesionSucursal(): Promise<SesionSucursal | null> {
  const tokenSucursal = (await cookies()).get("tokenSucursal")?.value;
  if (!tokenSucursal) return null;
  try {
    const { payload } = await jwtVerify(tokenSucursal, secret);
    const sucursalId = (payload as any)?.sucursalId || (payload as any)?.id;
    if (!sucursalId) return null;
    return { sucursalId };
  } catch {
    return null;
  }
}

/** Verifica sucursal + empleado (con su rol). Es la sesión completa post-PIN. */
export async function obtenerSesionEmpleado(): Promise<SesionEmpleado | null> {
  const cookieStore = await cookies();
  const tokenSucursal = cookieStore.get("tokenSucursal")?.value;
  const tokenEmpleado = cookieStore.get("tokenEmpleado")?.value;
  if (!tokenSucursal || !tokenEmpleado) return null;

  try {
    const { payload: payloadSucursal } = await jwtVerify(tokenSucursal, secret);
    const sucursalId = (payloadSucursal as any)?.sucursalId || (payloadSucursal as any)?.id;

    const { payload: payloadEmpleado } = await jwtVerify(tokenEmpleado, secret);
    const empleadoId = (payloadEmpleado as any)?.empleadoId || (payloadEmpleado as any)?.id;
    const rol = (payloadEmpleado as any)?.rol;

    if (!sucursalId || !empleadoId || !rol) return null;
    return { sucursalId, empleadoId, rol };
  } catch {
    return null;
  }
}

/**
 * Para usar al inicio de un route handler:
 *   const sesion = await requireEmpleado(["Administrador"]);
 *   if (esRespuestaError(sesion)) return sesion;
 *   // sesion.sucursalId / sesion.empleadoId / sesion.rol ya están verificados
 *
 * Sin `rolesPermitidos`, solo exige que haya una sesión de empleado válida
 * (cualquier rol). Con la lista, además exige que el rol esté en ella.
 */
export async function requireEmpleado(
  rolesPermitidos?: string[]
): Promise<SesionEmpleado | NextResponse> {
  const sesion = await obtenerSesionEmpleado();
  if (!sesion) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }
  if (rolesPermitidos && !rolesPermitidos.includes(sesion.rol)) {
    return NextResponse.json(
      { message: `Esta acción requiere rol: ${rolesPermitidos.join(" o ")}` },
      { status: 403 }
    );
  }
  return sesion;
}

export async function requireSucursal(): Promise<SesionSucursal | NextResponse> {
  const sesion = await obtenerSesionSucursal();
  if (!sesion) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }
  return sesion;
}

/** Type guard: ¿lo que devolvió requireEmpleado/requireSucursal es un error a retornar tal cual? */
export function esRespuestaError(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}
