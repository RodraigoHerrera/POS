// Pronóstico de demanda diaria por producto, a partir de la serie de ventas
// histórica. Funciones puras (sin Prisma) para que se puedan testear con datos
// en memoria; la consulta a historialVentas vive en el endpoint que las invoca.

export type MetodoPronostico =
  | "suavizacion_exponencial"
  | "promedio_simple_baja_confianza"
  | "sin_datos";

export interface ResultadoPronosticoSerie {
  demandaDiariaPromedio: number;
  cantidadHorizonte: number;
  mapePct: number | null;
  metodo: MetodoPronostico;
}

const MIN_DIAS_PARA_SUAVIZACION = 14;

/** Promedio móvil ponderado: más peso a los días recientes de la ventana. */
export function promedioMovilPonderado(historiaDiaria: number[], ventana = 7): number {
  const datos = historiaDiaria.slice(-ventana);
  if (datos.length === 0) return 0;

  const pesos = datos.map((_, i) => i + 1);
  const sumaPesos = pesos.reduce((a, b) => a + b, 0);
  const sumaPonderada = datos.reduce((acc, val, i) => acc + val * pesos[i], 0);
  return sumaPonderada / sumaPesos;
}

/**
 * Suavización exponencial simple (nivel, sin tendencia/estacionalidad).
 * Devuelve el nivel final (= pronóstico constante hacia adelante) y la serie
 * de niveles intermedios, usada también para el backtest de MAPE.
 */
export function suavizacionExponencial(
  historiaDiaria: number[],
  alpha = 0.3
): { nivel: number; serie: number[] } {
  if (historiaDiaria.length === 0) return { nivel: 0, serie: [] };

  let nivel = historiaDiaria[0];
  const serie = [nivel];
  for (let i = 1; i < historiaDiaria.length; i++) {
    nivel = alpha * historiaDiaria[i] + (1 - alpha) * nivel;
    serie.push(nivel);
  }
  return { nivel, serie };
}

/** MAPE clásico: ignora periodos con demanda real 0 (división por cero). */
export function calcularMAPE(actual: number[], pronosticado: number[]): number | null {
  const pares = actual
    .map((a, i) => ({ a, p: pronosticado[i] }))
    .filter(({ a }) => a > 0);

  if (pares.length === 0) return null;

  const sumaErrorPct = pares.reduce((acc, { a, p }) => acc + Math.abs(a - p) / a, 0);
  return (sumaErrorPct / pares.length) * 100;
}

/**
 * Backtest walk-forward: para cada día desde `minHistoria` en adelante,
 * pronostica usando solo los datos anteriores a ese día y compara contra el
 * valor real. Así el MAPE refleja error "fuera de muestra", no ajuste perfecto.
 */
export function backtestMAPE(
  historiaDiaria: number[],
  alpha = 0.3,
  minHistoria = 7
): number | null {
  if (historiaDiaria.length < minHistoria + 1) return null;

  const actuales: number[] = [];
  const pronosticos: number[] = [];
  for (let i = minHistoria; i < historiaDiaria.length; i++) {
    const { nivel } = suavizacionExponencial(historiaDiaria.slice(0, i), alpha);
    actuales.push(historiaDiaria[i]);
    pronosticos.push(nivel);
  }
  return calcularMAPE(actuales, pronosticos);
}

/**
 * Rellena los días sin venta con 0 entre fechaInicio y fechaFin (inclusive),
 * para que el promedio no sobreestime la demanda al ignorar días sin ventas.
 *
 * No rellena con 0 los días anteriores a la primera venta registrada en
 * `ventasPorDia`: ese tramo significa que el producto/sucursal todavía no
 * existía, no que la demanda fue nula, y arrastrar ceros ahí sesga el nivel
 * de la suavización exponencial hacia abajo durante toda la rampa de
 * arranque (ver backtestMAPE).
 */
export function construirSerieDiaria(
  ventasPorDia: Map<string, number>,
  fechaInicio: Date,
  fechaFin: Date
): number[] {
  const fin = new Date(fechaFin);
  fin.setHours(0, 0, 0, 0);

  const cursor = new Date(fechaInicio);
  cursor.setHours(0, 0, 0, 0);

  const primeraVentaKey = [...ventasPorDia.keys()].sort()[0];
  if (primeraVentaKey) {
    const primeraVenta = new Date(`${primeraVentaKey}T00:00:00`);
    if (primeraVenta > cursor) cursor.setTime(primeraVenta.getTime());
  }

  const serie: number[] = [];
  while (cursor <= fin) {
    const key = cursor.toISOString().slice(0, 10);
    serie.push(ventasPorDia.get(key) ?? 0);
    cursor.setDate(cursor.getDate() + 1);
  }
  return serie;
}

/**
 * Pronostica la demanda diaria promedio y el total para el horizonte dado.
 * - >= MIN_DIAS_PARA_SUAVIZACION días de historia: suavización exponencial +
 *   MAPE por backtest walk-forward.
 * - Historia más corta pero no vacía: promedio simple, marcado como baja
 *   confianza (sin MAPE, no hay suficientes puntos para un backtest serio).
 * - Sin historia: cero, método "sin_datos".
 */
export function pronosticarDemandaDiaria(
  historiaDiaria: number[],
  horizonteDias: number,
  opciones: { alpha?: number } = {}
): ResultadoPronosticoSerie {
  const alpha = opciones.alpha ?? 0.3;

  if (historiaDiaria.length === 0) {
    return { demandaDiariaPromedio: 0, cantidadHorizonte: 0, mapePct: null, metodo: "sin_datos" };
  }

  if (historiaDiaria.length < MIN_DIAS_PARA_SUAVIZACION) {
    const promedio =
      historiaDiaria.reduce((a, b) => a + b, 0) / historiaDiaria.length;
    return {
      demandaDiariaPromedio: promedio,
      cantidadHorizonte: promedio * horizonteDias,
      mapePct: null,
      metodo: "promedio_simple_baja_confianza",
    };
  }

  const { nivel } = suavizacionExponencial(historiaDiaria, alpha);
  const mapePct = backtestMAPE(historiaDiaria, alpha);

  return {
    demandaDiariaPromedio: nivel,
    cantidadHorizonte: nivel * horizonteDias,
    mapePct,
    metodo: "suavizacion_exponencial",
  };
}
