/**
 * Seed determinista y mínimo para la BD smoke. Solo escribe en una BD cuyo
 * nombre termina en `_test` (el guard se ejecuta antes de abrir la conexión).
 * Vacía todas las tablas y vuelve a insertar, así que es idempotente.
 */
import { PrismaClient, TipoItem } from '@prisma/client';
import bcrypt from 'bcrypt';
import { SMOKE } from './smokeEnv';
import { assertTestDatabaseUrl } from './testDb';

export async function seedTestDb(databaseUrl: string): Promise<void> {
  assertTestDatabaseUrl(databaseUrl);
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    // Defensa en profundidad: confirma el nombre real de la BD conectada.
    const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT DATABASE() AS db`;
    if (!db || !db.endsWith('_test')) throw new Error(`Abortado: conectado a "${db}", no a una BD _test.`);

    const tablas = await prisma.$queryRaw<{ t: string }[]>`
      SELECT TABLE_NAME AS t FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`;
    await prisma.$transaction([
      prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0'),
      ...tablas.map(({ t }) => prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${t.replace(/`/g, '')}\``)),
      prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1'),
    ]);

    const sucursal = await prisma.sucursales.create({
      data: {
        nombre: 'Sucursal Smoke',
        correo: SMOKE.sucursalCorreo,
        contrasena: await bcrypt.hash(SMOKE.sucursalPassword, 10),
        direccion: 'Av. Smoke 1',
        telefono: '70000000',
      },
    });
    const pin = await bcrypt.hash(SMOKE.pin, 10);
    await prisma.empleados.create({
      data: { sucursal_id: sucursal.id, rol: 'Administrador', usuario: SMOKE.admin, correo: 'admin@smash.test', nombre: 'Admin Smoke', contrasena: pin, estado: 'Activo' },
    });
    await prisma.empleados.create({
      data: { sucursal_id: sucursal.id, rol: 'Cajero', usuario: SMOKE.cajero, correo: 'cajero@smash.test', nombre: 'Cajero Smoke', contrasena: pin, estado: 'Activo' },
    });

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
    for (const [item, codigo, costo, cantidad] of [
      [carne, 'LOTE-SMOKE-CARNE', 30, 50],
      [pan, 'LOTE-SMOKE-PAN', 1, 200],
    ] as const) {
      const lote = await prisma.lote.create({
        data: { item_id: item.id, codigo_lote: codigo, costo_unit: costo, fecha_caducidad: caduca },
      });
      await prisma.stockLoteSucursal.create({ data: { sucursal_id: sucursal.id, lote_id: lote.id, cantidad } });
      await prisma.inventarioSucursal.create({
        data: { sucursal_id: sucursal.id, item_id: item.id, stock: cantidad, costo_promedio: costo },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}
