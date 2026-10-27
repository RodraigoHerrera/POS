import { esEmpleadoActivo } from "./empleadosKiosco";

interface SesionBase {
  sucursalId: string;
  empleadoId: string;
  rol: string;
}

interface FilaEmpleado {
  sucursal_id: bigint;
  rol: string;
  estado: string | null;
}

/**
 * El JWT del empleado dura 8h y no se puede revocar, así que la fila actual del
 * empleado manda: si fue dado de baja o cambió de sucursal la sesión muere, y el
 * rol vigente reemplaza al que quedó congelado en el token.
 */
export function reconciliarSesion<T extends SesionBase>(sesion: T, fila: FilaEmpleado | null): T | null {
  if (!fila) return null;
  if (fila.sucursal_id.toString() !== sesion.sucursalId) return null;
  if (!esEmpleadoActivo(fila.estado)) return null;
  return { ...sesion, rol: fila.rol };
}
