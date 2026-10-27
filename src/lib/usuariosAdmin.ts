import { esEmpleadoActivo } from "./empleadosKiosco";

// Roles que la administración de usuarios permite asignar.
export const ROLES_EMPLEADO = ["Administrador", "Cajero"] as const;

export function esRolEmpleado(rol: unknown): rol is (typeof ROLES_EMPLEADO)[number] {
  return ROLES_EMPLEADO.some((r) => r === rol);
}

// Normaliza a "Activo"/"Inactivo"; null si el valor no es un estado conocido.
export function estadoEmpleadoValido(estado: unknown): "Activo" | "Inactivo" | null {
  if (typeof estado !== "string") return null;
  const normalizado = estado.toLowerCase();
  if (normalizado === "activo") return "Activo";
  if (normalizado === "inactivo") return "Inactivo";
  return null;
}

// Misma regla que el registro: solo cuentas @gmail.com.
export function esCorreoGmail(correo: unknown): boolean {
  return typeof correo === "string" && /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(correo);
}

// ¿Aplicar `cambios` al objetivo dejaría la sucursal sin ningún administrador activo?
export function dejaSinAdministradores(
  objetivo: { rol: string; estado: string },
  cambios: { rol?: string; estado?: string },
  otrosAdministradoresActivos: number
): boolean {
  const eraAdminActivo = objetivo.rol === "Administrador" && esEmpleadoActivo(objetivo.estado);
  if (!eraAdminActivo) return false;
  const rolFinal = cambios.rol ?? objetivo.rol;
  const estadoFinal = cambios.estado ?? objetivo.estado;
  const seguiraAdminActivo = rolFinal === "Administrador" && esEmpleadoActivo(estadoFinal);
  return !seguiraAdminActivo && otrosAdministradoresActivos === 0;
}

export type ResumenUsuarios = {
  total: number;
  activos: number;
  administradores: number;
};

// Totales que se muestran en la cabecera de /admin/usuarios.
export function resumenUsuarios(
  empleados: { estado: string; rol: string }[]
): ResumenUsuarios {
  return {
    total: empleados.length,
    activos: empleados.filter((e) => esEmpleadoActivo(e.estado)).length,
    administradores: empleados.filter((e) => e.rol === "Administrador").length,
  };
}

// El estado se guarda con distintas mayúsculas; el selector usa estos dos valores.
export function estadoNormalizado(estado: string): "Activo" | "Inactivo" {
  return esEmpleadoActivo(estado) ? "Activo" : "Inactivo";
}
