// Explosión recursiva de receta (BOM) a partir del MPS, hasta llegar a
// insumos comprables (tipo "insumo"). Si un item "prep" no tiene receta
// estándar definida, no se aborta la corrida: se reporta como advertencia y
// el prep se trata como si fuera comprable directamente, para no perder la
// necesidad.
//
// Función pura: recibe el MPS y un mapa de recetas ya cargado desde la DB
// (una sola consulta en el endpoint), no toca Prisma.

export type TipoItemReceta = "vendible" | "insumo" | "prep";

export interface RecetaInsumoCargado {
  itemInsumoId: string;
  itemInsumoTipo: TipoItemReceta;
  cantidad: number;
  mermaPctRecetaItem: number; // 0-100
}

export interface RecetaCargada {
  rendimiento: number;
  mermaPctReceta: number; // 0-100
  insumos: RecetaInsumoCargado[];
}

/** Clave: id del item "padre" de la receta (vendible o prep). */
export type MapaRecetas = Map<string, RecetaCargada>;

export interface RequerimientoExplosion {
  itemId: string;
  cantidadBruta: number;
  nivel: number; // 0 = insumo/prep directo del MPS, 1+ = anidado vía prep
}

export interface AdvertenciaExplosion {
  itemId: string;
  mensaje: string;
}

export interface ExplosionResultado {
  requerimientos: RequerimientoExplosion[];
  advertencias: AdvertenciaExplosion[];
}

const MAX_NIVELES = 10; // guard contra ciclos / profundidad excesiva (prep A -> prep B -> prep A)

export function explotarMPS(
  mps: { itemId: string; tipo: TipoItemReceta; cantidad: number }[],
  recetas: MapaRecetas
): ExplosionResultado {
  const acumulado = new Map<string, number>();
  const nivelMinimoPorItem = new Map<string, number>();
  const advertencias: AdvertenciaExplosion[] = [];

  function acumular(itemId: string, cantidad: number, nivel: number) {
    acumulado.set(itemId, (acumulado.get(itemId) ?? 0) + cantidad);
    const nivelActual = nivelMinimoPorItem.get(itemId) ?? nivel;
    nivelMinimoPorItem.set(itemId, Math.min(nivelActual, nivel));
  }

  function explotar(
    itemId: string,
    tipo: TipoItemReceta,
    cantidadRequerida: number,
    nivel: number,
    pila: Set<string>
  ) {
    if (nivel > MAX_NIVELES) {
      advertencias.push({
        itemId,
        mensaje: `Profundidad de explosión excedida en "${itemId}" (posible ciclo de receta), se detiene esa rama`,
      });
      acumular(itemId, cantidadRequerida, nivel);
      return;
    }

    if (pila.has(itemId)) {
      advertencias.push({
        itemId,
        mensaje: `Ciclo de receta detectado en "${itemId}", se detiene la explosión de esa rama`,
      });
      acumular(itemId, cantidadRequerida, nivel);
      return;
    }

    const receta = recetas.get(itemId);
    if (!receta) {
      if (tipo === "prep") {
        advertencias.push({
          itemId,
          mensaje: `El prep "${itemId}" no tiene receta estándar definida; se incluye como necesidad directa sin explotar sus insumos`,
        });
      } else if (tipo === "vendible") {
        advertencias.push({
          itemId,
          mensaje: `El vendible "${itemId}" no tiene receta definida; no genera necesidad de insumos`,
        });
        return;
      }
      acumular(itemId, cantidadRequerida, nivel);
      return;
    }

    const rendimiento = receta.rendimiento > 0 ? receta.rendimiento : 1;
    const factorMermaReceta = 1 - (receta.mermaPctReceta || 0) / 100;
    const lotesNecesarios = cantidadRequerida / rendimiento / Math.max(factorMermaReceta, 0.01);

    const siguientePila = new Set(pila);
    siguientePila.add(itemId);

    for (const insumo of receta.insumos) {
      const factorMermaItem = 1 - (insumo.mermaPctRecetaItem || 0) / 100;
      const bruta = (lotesNecesarios * insumo.cantidad) / Math.max(factorMermaItem, 0.01);

      if (insumo.itemInsumoTipo === "prep") {
        explotar(insumo.itemInsumoId, "prep", bruta, nivel + 1, siguientePila);
      } else {
        acumular(insumo.itemInsumoId, bruta, nivel + 1);
      }
    }
  }

  for (const linea of mps) {
    explotar(linea.itemId, linea.tipo, linea.cantidad, 0, new Set());
  }

  const requerimientos: RequerimientoExplosion[] = [...acumulado.entries()].map(
    ([itemId, cantidadBruta]) => ({
      itemId,
      cantidadBruta,
      nivel: nivelMinimoPorItem.get(itemId) ?? 0,
    })
  );

  return { requerimientos, advertencias };
}
