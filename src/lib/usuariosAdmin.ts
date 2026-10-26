import { esEmpleadoActivo } from "./empleadosKiosco";

// Roles que la administración de usuarios permite asignar.
export const ROLES_EMPLEADO = ["Administrador", "Cajero"] as const;

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
