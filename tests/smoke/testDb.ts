// Guard y utilidades de URL para la base de datos de pruebas smoke.
// Funciones puras: ningún acceso a red ni a variables de entorno.

const SUFIJO_TEST = '_test';

function parsear(url: string | undefined): URL {
  if (!url) throw new Error(`DATABASE_URL ausente: se exige una base de datos cuyo nombre termine en "${SUFIJO_TEST}".`);
  try {
    return new URL(url);
  } catch {
    // No se incluye la URL en el mensaje para no filtrar credenciales.
    throw new Error(`DATABASE_URL inválida: se exige una base de datos cuyo nombre termine en "${SUFIJO_TEST}".`);
  }
}

export function databaseNameFromUrl(url: string | undefined): string {
  return decodeURIComponent(parsear(url).pathname.replace(/^\/+/, ''));
}

/** Lanza si el nombre de la BD de la URL no termina en `_test`. */
export function assertTestDatabaseUrl(url: string | undefined): void {
  const nombre = databaseNameFromUrl(url);
  if (!nombre.endsWith(SUFIJO_TEST) || nombre === SUFIJO_TEST) {
    throw new Error(
      `Abortado: la base de datos "${nombre || '(vacía)'}" no termina en "${SUFIJO_TEST}". ` +
        'Las pruebas smoke solo pueden escribir en una BD de pruebas.',
    );
  }
}

/** Misma instancia/credenciales; solo cambia el nombre de la BD a `<nombre>_test`. */
export function deriveTestDatabaseUrl(baseUrl: string | undefined): string {
  const u = parsear(baseUrl);
  const nombre = databaseNameFromUrl(baseUrl);
  if (!nombre) throw new Error('DATABASE_URL sin nombre de base de datos.');
  if (!nombre.endsWith(SUFIJO_TEST)) u.pathname = `/${nombre}${SUFIJO_TEST}`;
  const resultado = u.toString();
  assertTestDatabaseUrl(resultado);
  return resultado;
}
