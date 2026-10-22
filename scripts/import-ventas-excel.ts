import { prisma } from '../src/lib/db';
import fs from 'fs';
import path from 'path';

// Mapping from Excel product names to database catalog info
interface ProductMapping {
  dbNombre: string;
  categoria: string;
  sku: string;
  precio: number;
  costo: number;
}

const PRODUCT_MAP: Record<string, ProductMapping> = {
  'Clasica con queso': {
    dbNombre: 'Hamburguesa Clasica',
    categoria: 'Hamburguesa',
    sku: 'HAM-RES-CLA',
    precio: 40,
    costo: 16,
  },
  'Clasica sin Queso': {
    dbNombre: 'Hamburguesa Clásica Sin Queso',
    categoria: 'Hamburguesa',
    sku: 'HAM-RES-CLA-01',
    precio: 35,
    costo: 14,
  },
  'Tropical': {
    dbNombre: 'Hamburguesa Tropical',
    categoria: 'Hamburguesa',
    sku: 'HAM-RES-TRO',
    precio: 45,
    costo: 18,
  },
  'Tocinetta': {
    dbNombre: 'Hamburguesa Tocinetta',
    categoria: 'Hamburguesa',
    sku: 'HAM-RES-TOC-00',
    precio: 45,
    costo: 18,
  },
  'Blue': {
    dbNombre: 'Hamburguesa Bluecheese',
    categoria: 'Hamburguesa',
    sku: 'HAM-RES-BLU',
    precio: 50,
    costo: 20,
  },
  'Mafiosa': {
    dbNombre: 'Hamburguesa Mafiosa',
    categoria: 'Hamburguesa',
    sku: 'HAM-RES-MAF',
    precio: 45,
    costo: 18,
  },
  'choriguesa': {
    dbNombre: 'Hamburguesa Chorigueza',
    categoria: 'Hamburguesa',
    sku: 'HAM-CHO-ORI',
    precio: 50,
    costo: 20,
  },
  'Papas': {
    dbNombre: 'Porción de Papas',
    categoria: 'Acompañamiento',
    sku: 'PAP-FRI-01',
    precio: 15,
    costo: 6,
  },
  'Extras': {
    dbNombre: 'Extras',
    categoria: 'Extras',
    sku: 'EXT-VAR-01',
    precio: 5,
    costo: 2,
  },
  'Refresco pequeño': {
    dbNombre: 'Refresco Pequeño',
    categoria: 'Bebidas',
    sku: 'BEB-REF-PEQ',
    precio: 8,
    costo: 3,
  },
  'Refresco grande': {
    dbNombre: 'Refresco Grande',
    categoria: 'Bebidas',
    sku: 'BEB-REF-GRA',
    precio: 12,
    costo: 5,
  },
  'Extra salchiburguer/GRANDIOSA': {
    dbNombre: 'Extra Salchiburguer / Grandiosa',
    categoria: 'Extras',
    sku: 'EXT-SAL-GRA',
    precio: 10,
    costo: 4,
  },
  'Salchipapas': {
    dbNombre: 'Salchipapa',
    categoria: 'Salchipapa',
    sku: 'SAL-PAP',
    precio: 25,
    costo: 10,
  },
};

async function main() {
  console.log('Iniciando importación de ventas desde Excel...');

  // 1. Obtener sucursal y empleado existentes
  const sucursal = await prisma.sucursales.findFirst();
  if (!sucursal) {
    throw new Error('No se encontró ninguna sucursal en la base de datos.');
  }

  const empleado = await prisma.empleados.findFirst({
    where: { sucursal_id: sucursal.id },
  });
  if (!empleado) {
    throw new Error('No se encontró ningún empleado en la base de datos.');
  }

  console.log(`Usando Sucursal: ${sucursal.nombre} (ID: ${sucursal.id})`);
  console.log(`Usando Empleado: ${empleado.nombre} (ID: ${empleado.id})`);

  // 2. Asegurar que todos los productos existan en el catálogo (tabla item y producto)
  const productCatalogMap = new Map<string, { id: bigint; nombre: string; sku: string; precio: number; costo: number; categoria: string }>();

  for (const [excelName, mapping] of Object.entries(PRODUCT_MAP)) {
    // Buscar si ya existe en tabla producto
    let prod = await prisma.producto.findFirst({
      where: { nombre: mapping.dbNombre },
      include: { item_inventario: true },
    });

    if (!prod) {
      console.log(`Creando producto en catálogo: "${mapping.dbNombre}"...`);
      // Crear item inventario vendible
      let itm = await prisma.item.findUnique({
        where: { sku: mapping.sku },
      });

      if (!itm) {
        itm = await prisma.item.create({
          data: {
            nombre: mapping.dbNombre,
            sku: mapping.sku,
            tipo: 'vendible',
            unidad_code: 'unidad',
            activo: true,
          },
        });
      }

      prod = await prisma.producto.create({
        data: {
          nombre: mapping.dbNombre,
          descripcion: '',
          categoria: mapping.categoria,
          precio: mapping.precio,
          estado: 'activo',
          item_inventario_id: itm.id,
        },
        include: { item_inventario: true },
      });
    }

    const sku = prod.item_inventario?.sku || mapping.sku;
    productCatalogMap.set(excelName, {
      id: prod.id,
      nombre: prod.nombre,
      sku: sku,
      precio: Number(prod.precio),
      costo: mapping.costo,
      categoria: prod.categoria || mapping.categoria,
    });
  }

  // 3. Cargar registros extraídos del Excel
  const jsonPath = path.join(process.cwd(), 'scratch', 'ventas_extracted.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Archivo ${jsonPath} no encontrado. Ejecuta primero scratch/extract_ventas.py.`);
  }

  const rawRecords: Array<{ mes: string; fecha: string; producto_excel: string; cantidad: number }> = JSON.parse(
    fs.readFileSync(jsonPath, 'utf-8')
  );

  console.log(`Leídos ${rawRecords.length} registros para importar.`);

  // 4. Transformar a filas de historialVentas
  const filasHistorial = rawRecords.map((r, index) => {
    const prodInfo = productCatalogMap.get(r.producto_excel);
    if (!prodInfo) {
      throw new Error(`Producto no mapeado: "${r.producto_excel}"`);
    }

    // Fecha con hora fija a las 14:00 para evitar desfasajes UTC
    const fechaVenta = new Date(`${r.fecha}T14:00:00.000Z`);
    const cantidad = r.cantidad;
    const precioUnitario = prodInfo.precio;
    const costoUnitario = prodInfo.costo;
    const ventaTotal = cantidad * precioUnitario;
    const costoTotal = cantidad * costoUnitario;
    const margenGanancia = ventaTotal - costoTotal;

    return {
      fecha_venta: fechaVenta,
      sucursal_id: sucursal.id,
      producto_id: prodInfo.id,
      sku_producto: prodInfo.sku,
      producto_nombre: prodInfo.nombre,
      categoria: prodInfo.categoria,
      cantidad: cantidad,
      precio_unitario: precioUnitario,
      venta_total: ventaTotal,
      costo_unitario: costoUnitario,
      costo_total: costoTotal,
      margen_ganancia: margenGanancia,
      costo_teorico_unitario: costoUnitario,
      costo_teorico_total: costoTotal,
      nombre_cliente: 'Cliente Mostrador',
      numero_factura: `EXCEL-2026-${String(index + 1).padStart(4, '0')}`,
      metodo_pago: 'Efectivo',
      pedido_id: BigInt(700_000_000) + BigInt(index + 1),
      empleado_id: empleado.id,
    };
  });

  // 5. Inserción masiva en historialVentas
  console.log(`Insertando ${filasHistorial.length} filas en historialVentas...`);
  const result = await prisma.historialVentas.createMany({
    data: filasHistorial,
  });

  console.log(`Inserción completada exitosamente: ${result.count} registros insertados.`);

  // 6. Validación de totales
  const totalUnidades = filasHistorial.reduce((sum, f) => sum + f.cantidad, 0);
  console.log(`Total de unidades importadas: ${totalUnidades} (Esperado según Excel: 603)`);

  const agrupadoMes = await prisma.$queryRaw<Array<{ anio: number; mes: number; total: bigint }>>`
    SELECT YEAR(fecha_venta) as anio, MONTH(fecha_venta) as mes, SUM(cantidad) as total
    FROM historialVentas
    WHERE sucursal_id = ${sucursal.id}
    GROUP BY YEAR(fecha_venta), MONTH(fecha_venta)
    ORDER BY anio ASC, mes ASC;
  `;

  console.log('\nResumen agregado por mes en la base de datos:');
  const monthNames = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  for (const row of agrupadoMes) {
    console.log(`  ${row.anio} - ${monthNames[Number(row.mes)]}: ${Number(row.total)} unidades`);
  }
}

main()
  .catch((err) => {
    console.error('Error durante la importación:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
