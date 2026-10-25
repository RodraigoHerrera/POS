// Zona horaria de negocio del MRP. Las ventas se guardan en UTC; el "dia" de
// negocio debe ser el dia local de la sucursal (config: env MRP_TZ). Todo el
// calculo de claves de dia (YYYY-MM-DD) pasa por aqui para que la agrupacion de
// ventas y la iteracion de la serie usen la misma definicion de dia.
// Funciones puras: nunca dependen de la zona horaria de la maquina.

export const ZONA_MRP_DEFAULT = "America/La_Paz";

function zonaValida(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Zona de negocio efectiva: `valor` si es una zona IANA valida, si no el default. */
export function obtenerZonaMrp(valor: string | undefined = process.env.MRP_TZ): string {
  const tz = valor?.trim();
  return tz && zonaValida(tz) ? tz : ZONA_MRP_DEFAULT;
}

function partes(fecha: Date, tz: string) {
  const out: Record<string, number> = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(fecha)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out;
}

/** Clave YYYY-MM-DD del dia local de `fecha` en la zona `tz`. */
export function claveDia(fecha: Date, tz: string = obtenerZonaMrp()): string {
  const p = partes(fecha, tz);
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return `${String(p.year).padStart(4, "0")}-${mm}-${dd}`;
}

/** Desfase (segundos) de `tz` respecto de UTC en el instante `fecha` (La Paz = -14400). */
export function offsetSegundos(fecha: Date, tz: string = obtenerZonaMrp()): number {
  const p = partes(fecha, tz);
  const localComoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((localComoUtc - Math.floor(fecha.getTime() / 1000) * 1000) / 1000);
}

/** Suma `n` dias a una clave YYYY-MM-DD (aritmetica de calendario, sin zona). */
export function sumarDias(clave: string, n: number): string {
  const [y, m, d] = clave.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Claves de dia consecutivas entre `inicio` y `fin` (inclusive); vacio si inicio > fin. */
export function rangoDias(inicio: string, fin: string): string[] {
  const dias: string[] = [];
  for (let k = inicio; k <= fin; k = sumarDias(k, 1)) dias.push(k);
  return dias;
}

/** Instante UTC en que empieza el dia local `clave` (medianoche local) en `tz`. */
export function inicioDiaLocal(clave: string, tz: string = obtenerZonaMrp()): Date {
  const [y, m, d] = clave.split("-").map(Number);
  const medianocheComoUtc = Date.UTC(y, m - 1, d);
  return new Date(medianocheComoUtc - offsetSegundos(new Date(medianocheComoUtc), tz) * 1000);
}
