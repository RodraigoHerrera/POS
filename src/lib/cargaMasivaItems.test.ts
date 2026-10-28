import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  parsearCSVItems,
  validarFilasItems,
  generarPlantillaCSV,
  type FilaItemCSV,
  type PrismaItemsClient,
} from "./cargaMasivaItems";

describe("parsearCSVItems", () => {
  test("rechaza archivo vacío o solo espacios", () => {
    const res = parsearCSVItems("");
    assert.equal(res.ok, false);
    assert.match(res.error || "", /vacío/i);
  });

  test("remueve UTF-8 BOM e identifica delimitador por comas", () => {
    const csvConBom = "\uFEFFid,sku,nombre,tipo,unidad_code,costo_estandar,lead_time_dias\n,SKU-1,Tomate,insumo,kg,10.5,2";
    const res = parsearCSVItems(csvConBom);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.filas.length, 1);
    assert.equal(res.filas[0].nombre, "Tomate");
    assert.equal(res.filas[0].sku, "SKU-1");
    assert.equal(res.filas[0].tipo, "insumo");
  });

  test("soporta delimitador por punto y coma (formato Excel regional)", () => {
    const csvSemicolon = "id;sku;nombre;tipo;unidad_code;costo_estandar;lead_time_dias\n;SKU-2;Lechuga;insumo;kg;5,50;1";
    const res = parsearCSVItems(csvSemicolon);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.filas.length, 1);
    assert.equal(res.filas[0].nombre, "Lechuga");
    assert.equal(res.filas[0].sku, "SKU-2");
    assert.equal(res.filas[0].costo_estandar, "5.50"); // coma decimal normalizada
  });

  test("soporta valores entrecomillados con comas o saltos", () => {
    const csvQuotes = 'id,sku,nombre,tipo,unidad_code,costo_estandar,lead_time_dias\n,"SKU-3","Pan, con sésamo",insumo,u,1.20,0';
    const res = parsearCSVItems(csvQuotes);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.filas[0].nombre, "Pan, con sésamo");
  });

  test("rechaza archivo si faltan cabeceras obligatorias requeridas", () => {
    const csvInvalido = "columnaA,columnaB\n1,2";
    const res = parsearCSVItems(csvInvalido);
    assert.equal(res.ok, false);
    assert.match(res.error || "", /cabecera/i);
  });
});

describe("validarFilasItems", () => {
  test("valida exitosamente fila completa y válida", () => {
    const filas: FilaItemCSV[] = [
      {
        numeroFila: 2,
        id: "",
        sku: "BUR-01",
        nombre: "Hamburguesa Simple",
        tipo: "vendible",
        unidad_code: "u",
        costo_estandar: "15.00",
        lead_time_dias: "0",
      },
    ];

    const res = validarFilasItems(filas);
    assert.equal(res.validas.length, 1);
    assert.equal(res.invalidas.length, 0);
    assert.equal(res.validas[0].item.sku, "BUR-01");
    assert.equal(res.validas[0].item.costo_estandar, 15);
  });

  test("detecta errores de tipado: tipo inválido, números negativos", () => {
    const filas: FilaItemCSV[] = [
      {
        numeroFila: 2,
        id: "",
        sku: "",
        nombre: "Test Invalido",
        tipo: "categoria_falsa",
        unidad_code: "kg",
        costo_estandar: "-5",
        lead_time_dias: "abc",
      },
    ];

    const res = validarFilasItems(filas);
    assert.equal(res.validas.length, 0);
    assert.equal(res.invalidas.length, 1);
    const errores = res.invalidas[0].errores;
    assert.ok(errores.some((e) => /tipo/i.test(e)));
    assert.ok(errores.some((e) => /costo_estandar/i.test(e)));
    assert.ok(errores.some((e) => /lead_time_dias/i.test(e)));
  });

  test("detecta duplicados de id y sku dentro del mismo archivo CSV", () => {
    const filas: FilaItemCSV[] = [
      {
        numeroFila: 2,
        id: "10",
        sku: "SKU-DUP",
        nombre: "Item A",
        tipo: "insumo",
        unidad_code: "u",
        costo_estandar: "",
        lead_time_dias: "",
      },
      {
        numeroFila: 3,
        id: "10",
        sku: "SKU-DUP",
        nombre: "Item B",
        tipo: "insumo",
        unidad_code: "u",
        costo_estandar: "",
        lead_time_dias: "",
      },
    ];

    const res = validarFilasItems(filas);
    assert.equal(res.invalidas.length, 1);
    assert.equal(res.validas.length, 1);
    assert.ok(res.invalidas[0].errores.some((e) => /duplicado/i.test(e)));
  });

  test("detecta nombre vacío como error", () => {
    const filas: FilaItemCSV[] = [
      {
        numeroFila: 2,
        id: "",
        sku: "SKU-99",
        nombre: "   ",
        tipo: "insumo",
        unidad_code: "kg",
        costo_estandar: "",
        lead_time_dias: "",
      },
    ];

    const res = validarFilasItems(filas);
    assert.equal(res.invalidas.length, 1);
    assert.ok(res.invalidas[0].errores.some((e) => /nombre/i.test(e)));
  });
});

describe("generarPlantillaCSV", () => {
  test("genera cabeceras exactas sin vida_util_dias ni activo", () => {
    const plantilla = generarPlantillaCSV();
    assert.ok(plantilla.startsWith("\uFEFF"));
    assert.ok(plantilla.includes("id,sku,nombre,tipo,unidad_code,costo_estandar,lead_time_dias"));
    assert.ok(!plantilla.includes("vida_util_dias"));
    assert.ok(!plantilla.includes("activo"));
  });
});

describe("ejecutarCargaMasivaItems (Lógica de Upsert)", () => {
  test("inserta nuevo ítem cuando no existe id ni sku previo", async () => {
    const createdItems: Record<string, unknown>[] = [];
    const createdProductos: Record<string, unknown>[] = [];

    const mockPrisma = {
      item: {
        findUnique: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const item = { id: BigInt(101), ...data };
          createdItems.push(item);
          return { id: BigInt(101) };
        },
        update: async () => ({}),
      },
      producto: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          createdProductos.push(data);
          return { id: BigInt(1), ...data };
        },
      },
      movimientoInventario: { count: async () => 0 },
      inventarioSucursal: { count: async () => 0 },
    };

    const { ejecutarCargaMasivaItems } = await import("./cargaMasivaItems");

    const validas = [
      {
        fila: {
          numeroFila: 2,
          id: "",
          sku: "VEND-01",
          nombre: "Bebida Cola",
          tipo: "vendible",
          unidad_code: "u",
          costo_estandar: "5.00",
          lead_time_dias: "0",
        },
        item: {
          sku: "VEND-01",
          nombre: "Bebida Cola",
          tipo: "vendible" as const,
          unidad_code: "u",
          costo_estandar: 5,
          lead_time_dias: 0,
        },
      },
    ];

    const reporte = await ejecutarCargaMasivaItems(mockPrisma as unknown as PrismaItemsClient, { validas, invalidas: [] });
    assert.equal(reporte.totalFilas, 1);
    assert.equal(reporte.creados, 1);
    assert.equal(reporte.actualizados, 0);
    assert.equal(reporte.fallidos, 0);
    assert.equal(createdItems.length, 1);
    assert.equal(createdItems[0].activo, true); // Por defecto activo en creación
    assert.equal(createdProductos.length, 1); // Creó el producto vendible
  });

  test("actualiza ítem existente encontrado por sku sin modificar activo ni vida_util_dias", async () => {
    const updatedItems: { where: { id: bigint }; data: Record<string, unknown> }[] = [];

    const mockPrisma = {
      item: {
        findUnique: async (args: { where: { id: bigint; sku?: string } | { id?: bigint; sku: string } }) => {
          if ("sku" in args.where && args.where.sku === "INS-01") {
            return {
              id: BigInt(50),
              sku: "INS-01",
              nombre: "Carne Vieja",
              tipo: "insumo" as const,
              unidad_code: "kg",
            };
          }
          return null;
        },
        create: async () => ({ id: BigInt(1) }),
        update: async ({ where, data }: { where: { id: bigint }; data: Record<string, unknown> }) => {
          updatedItems.push({ where, data });
          return { id: where.id, ...data };
        },
      },
      movimientoInventario: { count: async () => 0 },
      inventarioSucursal: { count: async () => 0 },
    };

    const { ejecutarCargaMasivaItems } = await import("./cargaMasivaItems");

    const validas = [
      {
        fila: {
          numeroFila: 2,
          id: "",
          sku: "INS-01",
          nombre: "Carne Premium",
          tipo: "insumo",
          unidad_code: "kg",
          costo_estandar: "40.00",
          lead_time_dias: "1",
        },
        item: {
          sku: "INS-01",
          nombre: "Carne Premium",
          tipo: "insumo" as const,
          unidad_code: "kg",
          costo_estandar: 40,
          lead_time_dias: 1,
        },
      },
    ];

    const reporte = await ejecutarCargaMasivaItems(mockPrisma as unknown as PrismaItemsClient, { validas, invalidas: [] });
    assert.equal(reporte.totalFilas, 1);
    assert.equal(reporte.creados, 0);
    assert.equal(reporte.actualizados, 1);
    assert.equal(reporte.fallidos, 0);
    assert.equal(updatedItems.length, 1);
    assert.equal(updatedItems[0].data.nombre, "Carne Premium");
    assert.equal(updatedItems[0].data.activo, undefined); // No se modifica activo
    assert.equal(updatedItems[0].data.vida_util_dias, undefined); // No se modifica vida_util_dias
  });

  test("rechaza actualización si intenta cambiar el tipo de un ítem existente", async () => {
    const mockPrisma = {
      item: {
        findUnique: async () => ({
          id: BigInt(50),
          sku: "INS-01",
          nombre: "Carne",
          tipo: "insumo" as const,
          unidad_code: "kg",
        }),
        create: async () => ({ id: BigInt(1) }),
        update: async () => ({}),
      },
    };

    const { ejecutarCargaMasivaItems } = await import("./cargaMasivaItems");

    const validas = [
      {
        fila: {
          numeroFila: 2,
          id: "50",
          sku: "INS-01",
          nombre: "Carne",
          tipo: "vendible",
          unidad_code: "kg",
          costo_estandar: "",
          lead_time_dias: "",
        },
        item: {
          id: BigInt(50),
          sku: "INS-01",
          nombre: "Carne",
          tipo: "vendible" as const,
          unidad_code: "kg",
          costo_estandar: null,
          lead_time_dias: 0,
        },
      },
    ];

    const reporte = await ejecutarCargaMasivaItems(mockPrisma as unknown as PrismaItemsClient, { validas, invalidas: [] });
    assert.equal(reporte.actualizados, 0);
    assert.equal(reporte.fallidos, 1);
    assert.ok(reporte.detalles[0].errores?.some((e) => /tipo/i.test(e)));
  });
});
