/**
 * Seed determinista y mínimo para la BD smoke. Solo escribe en una BD cuyo
 * nombre termina en `_test` (el guard se ejecuta antes de abrir la conexión).
 * Vacía todas las tablas y vuelve a insertar, así que es idempotente.
 */
import { PrismaClient, TipoItem } from '@prisma/client';
import bcrypt from 'bcrypt';
import { SMOKE, TESTSPRITE, testSpriteId } from './smokeEnv';
import { assertTestDatabaseUrl } from './testDb';

type Catalogo = Awaited<ReturnType<typeof crearCatalogo>>;

interface SucursalSeed {
  nombre: string;
  correo: string;
  admin: { usuario: string; correo: string; nombre: string };
  cajero: { usuario: string; correo: string; nombre: string };
}

/** Datos globales (no dependen de la sucursal): items, producto, receta y lotes. */
async function crearCatalogo(prisma: PrismaClient) {
  const carne = await prisma.item.create({ data: { tipo: TipoItem.insumo, nombre: 'Carne Smoke', sku: 'INS-CARNE-SMOKE', unidad_code: 'kg' } });
  const pan = await prisma.item.create({ data: { tipo: TipoItem.insumo, nombre: 'Pan Smoke', sku: 'INS-PAN-SMOKE', unidad_code: 'u' } });
  const vendible = await prisma.item.create({ data: { tipo: TipoItem.vendible, nombre: SMOKE.producto, sku: 'VEN-HAMBURGUESA-SMOKE', unidad_code: 'u' } });
  await prisma.producto.create({
    data: { nombre: SMOKE.producto, categoria: 'Smoke', precio: SMOKE.precio, estado: 'activo', item_inventario_id: vendible.id },
  });

  const receta = await prisma.receta.create({ data: { item_vendible_id: vendible.id, rendimiento: 1 } });
  await prisma.recetaItem.createMany({
    data: [
      { receta_id: receta.id, item_insumo_id: carne.id, cantidad: 0.15 },
      { receta_id: receta.id, item_insumo_id: pan.id, cantidad: 1 },
    ],
  });

  const caduca = new Date();
  caduca.setDate(caduca.getDate() + 180);
  const insumos: { itemId: bigint; loteId: bigint; costo: number; cantidad: number }[] = [];
  for (const [item, codigo, costo, cantidad] of [
    [carne, 'LOTE-SMOKE-CARNE', 30, 50],
    [pan, 'LOTE-SMOKE-PAN', 1, 200],
  ] as const) {
    const lote = await prisma.lote.create({
      data: { item_id: item.id, codigo_lote: codigo, costo_unit: costo, fecha_caducidad: caduca },
    });
    insumos.push({ itemId: item.id, loteId: lote.id, costo, cantidad });
  }
  return { insumos };
}

/** Parte por sucursal: sucursal, admin, cajero y stock/inventario de los insumos. */
async function crearSucursal(prisma: PrismaClient, catalogo: Catalogo, datos: SucursalSeed) {
  const sucursal = await prisma.sucursales.create({
    data: {
      nombre: datos.nombre,
      correo: datos.correo,
      contrasena: await bcrypt.hash(SMOKE.sucursalPassword, 10),
      direccion: 'Av. Smoke 1',
      telefono: '70000000',
    },
  });
  const pin = await bcrypt.hash(SMOKE.pin, 10);
  await prisma.empleados.create({
    data: { sucursal_id: sucursal.id, rol: 'Administrador', usuario: datos.admin.usuario, correo: datos.admin.correo, nombre: datos.admin.nombre, contrasena: pin, estado: 'Activo' },
  });
  await prisma.empleados.create({
    data: { sucursal_id: sucursal.id, rol: 'Cajero', usuario: datos.cajero.usuario, correo: datos.cajero.correo, nombre: datos.cajero.nombre, contrasena: pin, estado: 'Activo' },
  });
  for (const { itemId, loteId, costo, cantidad } of catalogo.insumos) {
    await prisma.stockLoteSucursal.create({ data: { sucursal_id: sucursal.id, lote_id: loteId, cantidad } });
    await prisma.inventarioSucursal.create({
      data: { sucursal_id: sucursal.id, item_id: itemId, stock: cantidad, costo_promedio: costo },
    });
  }
  return sucursal;
}

/** Abre un cliente Prisma solo si la BD conectada realmente termina en `_test`. */
async function conClienteTest<T>(databaseUrl: string, fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  assertTestDatabaseUrl(databaseUrl);
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    // Defensa en profundidad: confirma el nombre real de la BD conectada.
    const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT DATABASE() AS db`;
    if (!db || !db.endsWith('_test')) throw new Error(`Abortado: conectado a "${db}", no a una BD _test.`);
    return await fn(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

export async function seedTestDb(databaseUrl: string): Promise<void> {
  await conClienteTest(databaseUrl, async (prisma) => {
    const tablas = await prisma.$queryRaw<{ t: string }[]>`
      SELECT TABLE_NAME AS t FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`;
    await prisma.$transaction([
      prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0'),
      ...tablas.map(({ t }) => prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${t.replace(/`/g, '')}\``)),
      prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1'),
    ]);

    const catalogo = await crearCatalogo(prisma);
    await crearSucursal(prisma, catalogo, {
      nombre: 'Sucursal Smoke',
      correo: SMOKE.sucursalCorreo,
      admin: { usuario: SMOKE.admin, correo: 'admin@smash.test', nombre: 'Admin Smoke' },
      cajero: { usuario: SMOKE.cajero, correo: 'cajero@smash.test', nombre: 'Cajero Smoke' },
    });
  });
}

/**
 * Agrega una sucursal aislada por caso TestSprite (TC001..TCnnn) sobre el seed
 * smoke ya existente: así ningún caso comparte caja abierta con otro. No vacía
 * nada; se espera tras `seedTestDb`. Reusa el catálogo global (producto y lotes).
 */
export async function seedTestSpriteBranches(databaseUrl: string, count: number = TESTSPRITE.count): Promise<void> {
  await conClienteTest(databaseUrl, async (prisma) => {
    const insumos: Catalogo['insumos'] = [];
    for (const [sku, costo, cantidad] of [
      ['INS-CARNE-SMOKE', 30, 50],
      ['INS-PAN-SMOKE', 1, 200],
    ] as const) {
      const item = await prisma.item.findFirstOrThrow({ where: { sku } });
      const lote = await prisma.lote.findFirstOrThrow({ where: { item_id: item.id } });
      insumos.push({ itemId: item.id, loteId: lote.id, costo, cantidad });
    }
    for (let i = 1; i <= count; i++) {
      const id = testSpriteId(i);
      const etiqueta = id.toUpperCase();
      await crearSucursal(prisma, { insumos }, {
        nombre: `Sucursal ${etiqueta}`,
        correo: `${id}@smash.test`,
        admin: { usuario: `admin_${id}`, correo: `admin_${id}@smash.test`, nombre: `Admin ${etiqueta}` },
        cajero: { usuario: `cajero_${id}`, correo: `cajero_${id}@smash.test`, nombre: `Cajero ${etiqueta}` },
      });
    }
  });
}
