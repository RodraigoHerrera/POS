// Reglas para la contraseña (PIN) de un empleado al cambiarla desde
// /admin/usuarios. Se comparte entre el formulario y la API.
export const LONGITUD_MINIMA_CONTRASENA = 4;

// Devuelve el mensaje de error o null si la contraseña es válida. La
// confirmación es opcional para que el servidor pueda validar solo la nueva.
export function validarNuevaContrasena(nueva: unknown, confirmacion?: unknown): string | null {
  if (typeof nueva !== "string" || nueva.trim() === "") {
    return "La contraseña es requerida";
  }
  if (nueva.length < LONGITUD_MINIMA_CONTRASENA) {
    return `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres`;
  }
  if (confirmacion !== undefined && nueva !== confirmacion) {
    return "Las contraseñas no coinciden";
  }
  return null;
}
