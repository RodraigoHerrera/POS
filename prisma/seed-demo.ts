/**
 * Seed idempotente de datos de demo para la defensa de tesis.
 * Corre contra el DATABASE_URL del .env actual. Todo lo que crea está
 * prefijado/identificado como "Demo" para no chocar con datos reales, y usa
 * upsert (o find-then-create donde el esquema no tiene un campo único) para
 * que ejecutarlo varias veces sea un no-op seguro.
 *
 * Uso: npm run db:seed:demo
 */
import { PrismaClient, TipoItem } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const SUCURSAL_CORREO = "demo@smash.com";
const ADMIN_USUARIO = "admin_demo";
const CAJERO_USUARIO = "cajero_demo";
const MESERO_USUARIO = "mesero_demo"; // creado en vivo por el test E2E (módulo Usuarios) — se limpia aquí para que cada reseed deje el módulo listo para repetir la demo
const PASSWORD_SUCURSAL = "DemoTesis2026!";
const PIN_EMPLEADO = "1234";

const PRECIO_HAMBURGUESA = 50; // Bs, redondo a propósito para que el arqueo de caja sea simple
const CANTIDAD_CARNE_POR_BURGER = 0.15; // kg
const CANTIDAD_PAN_POR_BURGER = 1; // u
const COSTO_CARNE_KG = 30; // Bs/kg
const COSTO_PAN_U = 1; // Bs/u
const STOCK_CARNE_KG = 5; // ~33 hamburguesas — insuficiente frente a la demanda pronosticada
const STOCK_PAN_U = 15; // ~15 hamburguesas — insuficiente, fuerte cuello de botella

const LOOKBACK_DIAS = 60;

async function main() {
  console.log("Seeding demo data...");

  // 0. Limpieza de artefactos dejados por corridas anteriores del test E2E
  // (el módulo "Usuarios" crea este empleado en vivo; el correo/usuario son
  // únicos en la BD, así que sin esta limpieza la segunda corrida del test
  // fallaría con "Ya existe un administrador con ese correo").
  await prisma.empleados.deleteMany({ where: { usuario: MESERO_USUARIO } });

  // 1. Sucursal demo
  const hashedSucursalPassword = await bcrypt.hash(PASSWORD_SUCURSAL, 10);
  const sucursal = await prisma.sucursales.upsert({
    where: { correo: SUCURSAL_CORREO },
    update: {},
    create: {
      nombre: "Sucursal Demo Tesis",
      correo: SUCURSAL_CORREO,
      contrasena: hashedSucursalPassword,
      direccion: "Av. Demo 123",
      telefono: "70000000",
    },
  });
  console.log(`Sucursal: ${sucursal.nombre} (#${sucursal.id})`);

  // 2. Empleados demo (Administrador + Cajero)
  const hashedPin = await bcrypt.hash(PIN_EMPLEADO, 10);
  const adminEmpleado = await prisma.empleados.upsert({
    where: { usuario: ADMIN_USUARIO },
    update: { sucursal_id: sucursal.id, estado: "Activo" },
    create: {
      sucursal_id: sucursal.id,
      rol: "Administrador",
      usuario: ADMIN_USUARIO,
      correo: "admin.demo@smash.com",
      nombre: "Admin Demo",
      contrasena: hashedPin,
      estado: "Activo",
    },
  });
  const cajeroEmpleado = await prisma.empleados.upsert({
    where: { usuario: CAJERO_USUARIO },
    update: { sucursal_id: sucursal.id, estado: "Activo" },
    create: {
      sucursal_id: sucursal.id,
      rol: "Cajero",
      usuario: CAJERO_USUARIO,
      correo: "cajero.demo@smash.com",
      nombre: "Cajero Demo",
      contrasena: hashedPin,
      estado: "Activo",
    },
  });
  console.log(`Empleados: ${adminEmpleado.usuario} (Administrador), ${cajeroEmpleado.usuario} (Cajero)`);

  // 3. Proveedor demo (solo para el insumo "Carne Demo", para que el MRP
  // pueda generar una OC automática; "Pan Demo" se deja sin proveedor a
  // propósito para mostrar la advertencia "Sin proveedor asignado").
  let proveedor = await prisma.proveedor.findFirst({ where: { nombre: "Proveedor Demo SRL" } });
  if (!proveedor) {
    proveedor = await prisma.proveedor.create({
      data: { nombre: "Proveedor Demo SRL", nit: "1234567890", contacto: "Juan Proveedor", telefono: "71111111" },
    });
  }

  // 4. Items (insumos + vendible) y producto
  const carne = await prisma.item.upsert({
    where: { sku: "INS-CARNE-DEMO" },
    update: {},
    create: {
      tipo: TipoItem.insumo,
      nombre: "Carne Demo",
      sku: "INS-CARNE-DEMO",
      unidad_code: "kg",
      lead_time_dias: 3,
      proveedor_id: proveedor.id,
    },
  });
  const pan = await prisma.item.upsert({
    where: { sku: "INS-PAN-DEMO" },
    update: {},
    create: {
      tipo: TipoItem.insumo,
      nombre: "Pan Demo",
      sku: "INS-PAN-DEMO",
      unidad_code: "u",
      lead_time_dias: 1,
    },
  });
  const itemVendible = await prisma.item.upsert({
    where: { sku: "VEN-HAMBURGUESA-DEMO" },
    update: {},
    create: {
      tipo: TipoItem.vendible,
      nombre: "Hamburguesa Demo",
      sku: "VEN-HAMBURGUESA-DEMO",
      unidad_code: "u",
    },
  });

  let producto = await prisma.producto.findFirst({ where: { nombre: "Hamburguesa Demo" } });
  if (!producto) {
    producto = await prisma.producto.create({
      data: {
        nombre: "Hamburguesa Demo",
        categoria: "Demo",
        precio: PRECIO_HAMBURGUESA,
        estado: "activo",
        item_inventario_id: itemVendible.id,
      },
    });
  } else {
    producto = await prisma.producto.update({
      where: { id: producto.id },
      data: { precio: PRECIO_HAMBURGUESA, estado: "activo", item_inventario_id: itemVendible.id },
    });
  }
  console.log(`Producto: ${producto.nombre} (#${producto.id}) Bs ${PRECIO_HAMBURGUESA}`);

  // 5. Receta (BOM): 1 Hamburguesa Demo = 0.15kg Carne Demo + 1u Pan Demo
  const receta = await prisma.receta.upsert({
    where: { item_vendible_id: itemVendible.id },
    update: { rendimiento: 1 },
    create: { item_vendible_id: itemVendible.id, rendimiento: 1 },
  });
  await prisma.recetaItem.deleteMany({ where: { receta_id: receta.id } });
  await prisma.recetaItem.createMany({
    data: [
      { receta_id: receta.id, item_insumo_id: carne.id, cantidad: CANTIDAD_CARNE_POR_BURGER },
      { receta_id: receta.id, item_insumo_id: pan.id, cantidad: CANTIDAD_PAN_POR_BURGER },
    ],
  });

  // 6. Lotes + stock por lote/sucursal + inventario agregado por sucursal
  const fechaCaducidadFutura = new Date();
  fechaCaducidadFutura.setDate(fechaCaducidadFutura.getDate() + 180);

  await seedStockInsumo({
    sucursalId: sucursal.id,
    item: carne,
    codigoLote: "LOTE-DEMO-CARNE",
    costoUnit: COSTO_CARNE_KG,
    cantidad: STOCK_CARNE_KG,
    fechaCaducidad: fechaCaducidadFutura,
  });
  await seedStockInsumo({
    sucursalId: sucursal.id,
    item: pan,
    codigoLote: "LOTE-DEMO-PAN",
    costoUnit: COSTO_PAN_U,
    cantidad: STOCK_PAN_U,
    fechaCaducidad: fechaCaducidadFutura,
  });

  // 7. Historial de ventas (60 días) para que el dashboard y el MRP tengan
  // señal real de pronóstico. Se reemplaza por completo en cada corrida del
  // seed para que el script sea idempotente.
  await prisma.historialVentas.deleteMany({
    where: { sucursal_id: sucursal.id, producto_id: producto.id },
  });

  const costoUnitario = CANTIDAD_CARNE_POR_BURGER * COSTO_CARNE_KG + CANTIDAD_PAN_POR_BURGER * COSTO_PAN_U;
  const filas = [];
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
  for (let i = LOOKBACK_DIAS; i >= 1; i--) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - i);
    const diaSemana = fecha.getDay(); // 0=Dom..6=Sab
    const boostFinDeSemana = diaSemana === 0 || diaSemana === 6 ? 4 : 0;
    const ruido = Math.round(2 * Math.sin(i * 1.3));
    const cantidad = Math.max(1, 8 + boostFinDeSemana + ruido);
    const ventaTotal = cantidad * PRECIO_HAMBURGUESA;
    const costoTotal = cantidad * costoUnitario;

    filas.push({
      fecha_venta: fecha,
      sucursal_id: sucursal.id,
      producto_id: producto.id,
      sku_producto: itemVendible.sku,
      producto_nombre: producto.nombre,
      categoria: producto.categoria,
      cantidad,
      precio_unitario: PRECIO_HAMBURGUESA,
      venta_total: ventaTotal,
      costo_unitario: costoUnitario,
      costo_total: costoTotal,
      margen_ganancia: ventaTotal - costoTotal,
      costo_teorico_unitario: costoUnitario,
      costo_teorico_total: costoTotal,
      nombre_cliente: "Cliente Demo",
      numero_factura: `DEMO-${LOOKBACK_DIAS - i}`,
      metodo_pago: "Efectivo",
      pedido_id: BigInt(900_000_000) + BigInt(LOOKBACK_DIAS - i),
      empleado_id: cajeroEmpleado.id,
    });
  }
  await prisma.historialVentas.createMany({ data: filas });
  console.log(`Historial de ventas: ${filas.length} días sembrados para "${producto.nombre}"`);

  console.log("\nListo. Credenciales de demo:");
  console.log(`  Sucursal -> correo: ${SUCURSAL_CORREO} / contraseña: ${PASSWORD_SUCURSAL}`);
  console.log(`  Empleados -> usuario: ${ADMIN_USUARIO} | ${CAJERO_USUARIO} / PIN: ${PIN_EMPLEADO}`);
}

async function seedStockInsumo(params: {
  sucursalId: bigint;
  item: { id: bigint };
  codigoLote: string;
  costoUnit: number;
  cantidad: number;
  fechaCaducidad: Date;
}) {
  const { sucursalId, item, codigoLote, costoUnit, cantidad, fechaCaducidad } = params;

  const lote = await prisma.lote.upsert({
    where: { item_id_codigo_lote: { item_id: item.id, codigo_lote: codigoLote } },
    update: { costo_unit: costoUnit, fecha_caducidad: fechaCaducidad },
    create: {
      item_id: item.id,
      codigo_lote: codigoLote,
      costo_unit: costoUnit,
      fecha_caducidad: fechaCaducidad,
    },
  });

  await prisma.stockLoteSucursal.upsert({
    where: { sucursal_id_lote_id: { sucursal_id: sucursalId, lote_id: lote.id } },
    update: { cantidad },
    create: { sucursal_id: sucursalId, lote_id: lote.id, cantidad },
  });

  await prisma.inventarioSucursal.upsert({
    where: { sucursal_id_item_id: { sucursal_id: sucursalId, item_id: item.id } },
    update: { stock: cantidad, costo_promedio: costoUnit },
    create: { sucursal_id: sucursalId, item_id: item.id, stock: cantidad, costo_promedio: costoUnit },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
