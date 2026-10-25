// Pantalla de inicio de cada rol tras el login por PIN. Un rol que no está
// acá no tiene pantalla propia: el llamador debe mostrar un error.
const RUTAS: Record<string, string> = {
  Administrador: "/admin",
  Cajero: "/cajero",
};

export function rutaPorRol(rol: unknown): string | null {
  if (typeof rol !== "string") return null;
  return Object.hasOwn(RUTAS, rol) ? RUTAS[rol] : null;
}
