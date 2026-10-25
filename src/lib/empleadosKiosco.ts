// Vista mínima de empleados para la pantalla de selección (/usuarios), que se
// muestra en una terminal compartida solo con la sesión de sucursal: nunca
// debe exponer datos de contacto ni empleados dados de baja.

export interface EmpleadoKiosco {
  id: string;
  usuario: string;
  rol: string;
  fotoUrl: string;
}

interface EmpleadoFuente {
  id: bigint;
  usuario: string;
  rol: string;
  estado: string | null;
}

const FOTO_POR_DEFECTO = "/default-user.jpg";

export function esEmpleadoActivo(estado: string | null | undefined): boolean {
  return (estado ?? "").toLowerCase() === "activo";
}

export function empleadosParaKiosco(empleados: EmpleadoFuente[]): EmpleadoKiosco[] {
  return empleados
    .filter((e) => esEmpleadoActivo(e.estado))
    .map((e) => ({
      id: e.id.toString(),
      usuario: e.usuario,
      rol: e.rol,
      fotoUrl: FOTO_POR_DEFECTO,
    }));
}

/** Vista para la pantalla de PIN: solo el usuario, y solo si el empleado está activo. */
export function empleadoParaPin(
  empleado: { usuario: string; estado: string | null } | null
): { usuario: string } | null {
  if (!empleado || !esEmpleadoActivo(empleado.estado)) return null;
  return { usuario: empleado.usuario };
}

function esEmpleadoKiosco(x: unknown): x is EmpleadoKiosco {
  if (typeof x !== "object" || x === null) return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.usuario === "string" &&
    typeof e.rol === "string" &&
    typeof e.fotoUrl === "string"
  );
}

/** Valida la respuesta de /api/usuarios/kiosco; null si es un error o viene mal formada. */
export function parsearEmpleadosKiosco(data: unknown): EmpleadoKiosco[] | null {
  if (!Array.isArray(data) || !data.every(esEmpleadoKiosco)) return null;
  return data;
}

/** Valida la respuesta de /api/usuarios/[id]; null si es un error o viene mal formada. */
export function usuarioDesdeRespuestaPin(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const usuario = (data as Record<string, unknown>).usuario;
  return typeof usuario === "string" && usuario !== "" ? usuario : null;
}

/**
 * Decide si el login por PIN procede. Un empleado inactivo se rechaza igual
 * que un PIN incorrecto: responder distinto revelaría que el PIN era válido.
 */
export function puedeIniciarSesionConPin(
  empleado: { sucursal_id: bigint; estado: string | null } | null,
  sucursalId: string,
  pinValido: boolean
): boolean {
  return (
    !!empleado &&
    empleado.sucursal_id.toString() === sucursalId &&
    esEmpleadoActivo(empleado.estado) &&
    pinValido
  );
}

/** Ruta de la pantalla de PIN para un empleado; el id va codificado. */
export function rutaPinEmpleado(id: string): string {
  return `/usuarios/pin?id=${encodeURIComponent(id)}`;
}
