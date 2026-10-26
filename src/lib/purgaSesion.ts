// Decide si una petición a /usuarios debe destruir tokenEmpleado (SEC-02).
// Solo una navegación real a la pantalla de selección de empleado purga:
// subrutas (/usuarios/pin), recursos mal resueltos bajo /usuarios y
// prefetches no deben cerrar la sesión recién abierta con el PIN.
export function debePurgarEmpleado(pathname: string, headers: Headers): boolean {
  if (pathname !== "/usuarios" && pathname !== "/usuarios/") return false;

  if (headers.get("next-router-prefetch")) return false;
  const purpose = `${headers.get("purpose") ?? ""} ${headers.get("sec-purpose") ?? ""}`;
  if (purpose.includes("prefetch")) return false;

  return true;
}
