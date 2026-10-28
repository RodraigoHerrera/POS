import type { Prisma, PrismaClient } from "@prisma/client";

export type TipoItemValido = "vendible" | "insumo" | "prep" | "oficina";

export interface FilaItemCSV {
  numeroFila: number;
  id: string;
  sku: string;
  nombre: string;
  tipo: string;
  unidad_code: string;
  costo_estandar: string;
  lead_time_dias: string;
}

export interface ItemNormalizado {
  id?: bigint;
  sku: string | null;
  nombre: string;
  tipo: TipoItemValido;
  unidad_code: string;
  costo_estandar: number | null;
  lead_time_dias: number;
}

export interface FilaValidada {
  fila: FilaItemCSV;
  item: ItemNormalizado;
}

export interface FilaInvalida {
  fila: FilaItemCSV;
  errores: string[];
}

export interface ValidacionResultado {
  validas: FilaValidada[];
  invalidas: FilaInvalida[];
}

const CABECERAS_ESPERADAS = [
  "id",
  "sku",
  "nombre",
  "tipo",
  "unidad_code",
  "costo_estandar",
  "lead_time_dias",
] as const;

const TIPOS_VALIDOS: readonly TipoItemValido[] = ["vendible", "insumo", "prep", "oficina"];

/**
 * Parsea el texto crudo CSV respetando RFC 4180, comillas y delimitadores (, o ;)
 */
export function parsearLineasCSV(texto: string, delimitador: string): string[][] {
  const lineas: string[][] = [];
  let filaActual: string[] = [];
  let campoActual = "";
  let dentroComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    const sig = texto[i + 1];

    if (dentroComillas) {
      if (c === '"') {
        if (sig === '"') {
          campoActual += '"';
          i++; // saltar comilla de escape
        } else {
          dentroComillas = false;
        }
      } else {
        campoActual += c;
      }
    } else {
      if (c === '"') {
        dentroComillas = true;
      } else if (c === delimitador) {
        filaActual.push(campoActual);
        campoActual = "";
      } else if (c === "\r") {
        if (sig === "\n") i++;
        filaActual.push(campoActual);
        lineas.push(filaActual);
        filaActual = [];
        campoActual = "";
      } else if (c === "\n") {
        filaActual.push(campoActual);
        lineas.push(filaActual);
        filaActual = [];
        campoActual = "";
      } else {
        campoActual += c;
      }
    }
  }

  if (campoActual !== "" || filaActual.length > 0) {
    filaActual.push(campoActual);
    lineas.push(filaActual);
  }

  return lineas;
}

/**
 * Parsea y valida las cabeceras de un archivo CSV de items.
 */
export function parsearCSVItems(
  contenido: string
): { ok: true; filas: FilaItemCSV[] } | { ok: false; error: string } {
  if (!contenido || contenido.trim() === "") {
    return { ok: false, error: "El archivo CSV está vacío." };
  }

  // Quitar BOM si existe
  const sinBom = contenido.startsWith("\uFEFF") ? contenido.slice(1) : contenido;

  // Detectar delimitador según la primera línea
  const primeraLinea = sinBom.split(/\r\n|\n|\r/)[0] || "";
  const cuentaComas = (primeraLinea.match(/,/g) || []).length;
  const cuentaPuntosComa = (primeraLinea.match(/;/g) || []).length;
  const delimitador = cuentaPuntosComa > cuentaComas ? ";" : ",";

  const matriz = parsearLineasCSV(sinBom, delimitador);
  if (matriz.length === 0) {
    return { ok: false, error: "El archivo no contiene filas legibles." };
  }

  const cabeceras = matriz[0].map((h) => h.trim().toLowerCase());
  const indices: Record<string, number> = {};

  for (const esperada of CABECERAS_ESPERADAS) {
    const idx = cabeceras.indexOf(esperada);
    if (idx === -1) {
      return {
        ok: false,
        error: `Falta la cabecera obligatoria: "${esperada}". Cabeceras encontradas: ${cabeceras.join(", ")}`,
      };
    }
    indices[esperada] = idx;
  }

  const filas: FilaItemCSV[] = [];

  for (let i = 1; i < matriz.length; i++) {
    const linea = matriz[i];
    // Saltar filas completamente en blanco
    if (linea.length === 0 || (linea.length === 1 && linea[0].trim() === "")) {
      continue;
    }

    const obtenerValor = (col: (typeof CABECERAS_ESPERADAS)[number]) => {
      const idx = indices[col];
      const val = linea[idx] !== undefined ? linea[idx].trim() : "";
      // Si usamos punto y coma y hay coma en decimal, normalizar a punto
      if (delimitador === ";" && (col === "costo_estandar")) {
        return val.replace(",", ".");
      }
      return val;
    };

    filas.push({
      numeroFila: i + 1,
      id: obtenerValor("id"),
      sku: obtenerValor("sku"),
      nombre: obtenerValor("nombre"),
      tipo: obtenerValor("tipo"),
      unidad_code: obtenerValor("unidad_code"),
      costo_estandar: obtenerValor("costo_estandar"),
      lead_time_dias: obtenerValor("lead_time_dias"),
    });
  }

  return { ok: true, filas };
}

/**
 * Valida los datos tipados de cada fila y detecta duplicados dentro del mismo archivo.
 */
export function validarFilasItems(filas: FilaItemCSV[]): ValidacionResultado {
  const validas: FilaValidada[] = [];
  const invalidas: FilaInvalida[] = [];

  const idsVistos = new Set<string>();
  const skusVistos = new Set<string>();

  for (const fila of filas) {
    const errores: string[] = [];

    // Validar Nombre
    const nombre = fila.nombre.trim();
    if (!nombre) {
      errores.push("El campo 'nombre' es obligatorio y no puede estar vacío.");
    } else if (nombre.length > 255) {
      errores.push("El 'nombre' excede los 255 caracteres.");
    }

    // Validar Tipo
    const tipoNormalizado = fila.tipo.trim().toLowerCase() as TipoItemValido;
    if (!tipoNormalizado) {
      errores.push("El campo 'tipo' es obligatorio.");
    } else if (!TIPOS_VALIDOS.includes(tipoNormalizado)) {
      errores.push(`El 'tipo' "${fila.tipo}" es inválido. Valores permitidos: ${TIPOS_VALIDOS.join(", ")}`);
    }

    // Validar Unidad Code
    const unidad_code = fila.unidad_code.trim();
    if (!unidad_code) {
      errores.push("El campo 'unidad_code' es obligatorio.");
    } else if (unidad_code.length > 16) {
      errores.push("El campo 'unidad_code' no puede exceder 16 caracteres.");
    }

    // Validar Costo Estándar
    let costo_estandar: number | null = null;
    if (fila.costo_estandar) {
      const parsedCosto = Number(fila.costo_estandar);
      if (Number.isNaN(parsedCosto) || parsedCosto < 0) {
        errores.push("El 'costo_estandar' debe ser un número decimal mayor o igual a 0.");
      } else {
        costo_estandar = parsedCosto;
      }
    }

    // Validar Lead Time
    let lead_time_dias = 0;
    if (fila.lead_time_dias) {
      const parsedLead = Number(fila.lead_time_dias);
      if (!Number.isInteger(parsedLead) || parsedLead < 0) {
        errores.push("El 'lead_time_dias' debe ser un número entero mayor o igual a 0.");
      } else {
        lead_time_dias = parsedLead;
      }
    }

    // Validar ID (si viene provisto)
    let idBigInt: bigint | undefined = undefined;
    if (fila.id) {
      try {
        const idNum = BigInt(fila.id);
        if (idNum <= BigInt(0)) {
          errores.push("El 'id' debe ser un número positivo.");
        } else {
          idBigInt = idNum;
          if (idsVistos.has(fila.id)) {
            errores.push(`ID duplicado en el archivo CSV: "${fila.id}".`);
          } else {
            idsVistos.add(fila.id);
          }
        }
      } catch {
        errores.push("El 'id' provisto no es un identificador numérico válido.");
      }
    }

    // Validar SKU (si viene provisto)
    const sku = fila.sku.trim() ? fila.sku.trim() : null;
    if (sku) {
      if (skusVistos.has(sku)) {
        errores.push(`SKU duplicado en el archivo CSV: "${sku}".`);
      } else {
        skusVistos.add(sku);
      }
    }

    if (errores.length > 0) {
      invalidas.push({ fila, errores });
    } else {
      validas.push({
        fila,
        item: {
          id: idBigInt,
          sku,
          nombre,
          tipo: tipoNormalizado,
          unidad_code,
          costo_estandar,
          lead_time_dias,
        },
      });
    }
  }

  return { validas, invalidas };
}

export interface FilaDetalleResultado {
  fila: number;
  identificador: string;
  nombre: string;
  estado: "creado" | "actualizado" | "error";
  errores?: string[];
}

export interface ReporteCargaMasiva {
  totalFilas: number;
  creados: number;
  actualizados: number;
  fallidos: number;
  detalles: FilaDetalleResultado[];
}

export interface ItemDBSnapshot {
  id: bigint;
  sku: string | null;
  nombre: string;
  tipo: TipoItemValido;
  unidad_code: string;
}

export type PrismaItemsClient = PrismaClient | Prisma.TransactionClient;

/**
 * Ejecuta la operación Upsert fila por fila contra la base de datos y genera el reporte.
 */
export async function ejecutarCargaMasivaItems(
  prismaClient: PrismaItemsClient,
  resultadoValidacion: ValidacionResultado
): Promise<ReporteCargaMasiva> {
  const detalles: FilaDetalleResultado[] = [];
  let creados = 0;
  let actualizados = 0;
  let fallidos = 0;

  // Registrar filas que ya fallaron la validación sintáctica/estructural
  for (const inv of resultadoValidacion.invalidas) {
    fallidos++;
    detalles.push({
      fila: inv.fila.numeroFila,
      identificador: inv.fila.id || inv.fila.sku || "-",
      nombre: inv.fila.nombre || "Sin nombre",
      estado: "error",
      errores: inv.errores,
    });
  }

  // Procesar filas válidas
  for (const val of resultadoValidacion.validas) {
    const { fila, item } = val;
    const identificador = item.id ? String(item.id) : item.sku || "-";

    try {
      let existing: ItemDBSnapshot | null = null;

      // 1. Buscar por ID si fue provisto
      if (item.id !== undefined) {
        existing = await prismaClient.item.findUnique({
          where: { id: item.id },
        });
      }

      // 2. Si no se encontró por ID y tiene SKU, buscar por SKU
      if (!existing && item.sku) {
        existing = await prismaClient.item.findUnique({
          where: { sku: item.sku },
        });
      }

      if (existing) {
        // === UPDATE ===
        const erroresUpdate: string[] = [];

        // Regla inmutable: tipo
        if (item.tipo !== existing.tipo) {
          erroresUpdate.push(
            `No se puede modificar el tipo de un ítem existente (actual: ${existing.tipo}, recibido: ${item.tipo}).`
          );
        }

        // Regla: unidad_code
        let unidadCodeValida = existing.unidad_code;
        if (item.unidad_code !== existing.unidad_code) {
          const movimientos = prismaClient.movimientoInventario
            ? await prismaClient.movimientoInventario.count({ where: { item_id: existing.id } })
            : 0;
          const stock = prismaClient.inventarioSucursal
            ? await prismaClient.inventarioSucursal.count({ where: { item_id: existing.id } })
            : 0;

          if (movimientos > 0 || stock > 0) {
            erroresUpdate.push(
              "No se puede cambiar la unidad de medida porque el ítem ya tiene historial o stock."
            );
          } else {
            unidadCodeValida = item.unidad_code;
          }
        }

        // Regla: SKU uniqueness si cambió
        if (item.sku && item.sku !== existing.sku) {
          const otroItem = await prismaClient.item.findUnique({
            where: { sku: item.sku },
          });
          if (otroItem && otroItem.id !== existing.id) {
            erroresUpdate.push(`Ya existe otro ítem con el SKU "${item.sku}".`);
          }
        }

        if (erroresUpdate.length > 0) {
          fallidos++;
          detalles.push({
            fila: fila.numeroFila,
            identificador,
            nombre: item.nombre,
            estado: "error",
            errores: erroresUpdate,
          });
          continue;
        }

        await prismaClient.item.update({
          where: { id: existing.id },
          data: {
            nombre: item.nombre,
            sku: item.sku,
            unidad_code: unidadCodeValida,
            costo_estandar: item.costo_estandar,
            lead_time_dias: item.lead_time_dias,
          },
        });

        actualizados++;
        detalles.push({
          fila: fila.numeroFila,
          identificador,
          nombre: item.nombre,
          estado: "actualizado",
        });
      } else {
        // === INSERT ===
        const erroresInsert: string[] = [];

        if (item.sku) {
          const skuEnUso = await prismaClient.item.findUnique({
            where: { sku: item.sku },
          });
          if (skuEnUso) {
            erroresInsert.push(`Ya existe un ítem con el SKU "${item.sku}".`);
          }
        }

        if (erroresInsert.length > 0) {
          fallidos++;
          detalles.push({
            fila: fila.numeroFila,
            identificador,
            nombre: item.nombre,
            estado: "error",
            errores: erroresInsert,
          });
          continue;
        }

        const nuevoItem = await prismaClient.item.create({
          data: {
            nombre: item.nombre,
            sku: item.sku,
            tipo: item.tipo,
            unidad_code: item.unidad_code,
            costo_estandar: item.costo_estandar,
            lead_time_dias: item.lead_time_dias,
            activo: true,
          },
        });

        if (item.tipo === "vendible" && prismaClient.producto) {
          await prismaClient.producto.create({
            data: {
              nombre: item.nombre,
              precio: 0,
              estado: "Inactivo",
              item_inventario_id: nuevoItem.id,
            },
          });
        }

        creados++;
        detalles.push({
          fila: fila.numeroFila,
          identificador: item.sku || String(nuevoItem.id),
          nombre: item.nombre,
          estado: "creado",
        });
      }
    } catch (err: unknown) {
      fallidos++;
      const mensaje = err instanceof Error ? err.message : "Error al procesar registro en base de datos.";
      detalles.push({
        fila: fila.numeroFila,
        identificador,
        nombre: item.nombre,
        estado: "error",
        errores: [mensaje],
      });
    }
  }

  // Ordenar los detalles por número de fila para que la auditoría sea secuencial
  detalles.sort((a, b) => a.fila - b.fila);

  return {
    totalFilas: detalles.length,
    creados,
    actualizados,
    fallidos,
    detalles,
  };
}

/**
 * Genera el texto CSV de plantilla con cabeceras requeridas, BOM UTF-8 y ejemplos
 */
export function generarPlantillaCSV(): string {
  const cabecera = CABECERAS_ESPERADAS.join(",");
  const ejemplos = [
    ",INS-001,Carne de Res Molida,insumo,kg,35.50,2",
    ",INS-002,Pan para Hamburguesa,insumo,u,1.50,1",
    ",VEN-001,Hamburguesa Smash Clásica,vendible,u,28.00,0",
  ];

  return `\uFEFF${cabecera}\r\n${ejemplos.join("\r\n")}\r\n`;
}
