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
