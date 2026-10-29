import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import { obtenerZonaMrp } from "@/lib/mrp/zonaHoraria";
import {
  CABECERAS_ANULADAS,
  CABECERAS_CAJA,
  CABECERAS_PRODUCTO_DETALLE,
  CABECERAS_PRODUCTO_RESUMEN,
  CABECERAS_USUARIO,
  ReporteVentasError,
  filasAnuladas,
  filasPorCaja,
  filasPorUsuario,
  filasProductoDetalle,
  filasProductoResumen,
  generarCSV,
  parseFormatoReporte,
  parseRangoFechas,
  parseTipoReporte,
  recortarVistaPrevia,
  LIMITE_VISTA_PREVIA,
  type Celda,
  type EmpleadoInfo,
} from "@/lib/reporteVentas";

export const dynamic = "force-dynamic";

type Rango = { inicio: Date; fin: Date };
// `total` is set only when the query was already limited in the DB (preview).
type Reporte = { cabeceras: readonly string[]; filas: Celda[][]; total?: number };

async function cargarEmpleados(ids: bigint[]): Promise<Map<string, EmpleadoInfo>> {
  if (ids.length === 0) return new Map();
  const empleados = await prisma.empleados.findMany({
    where: { id: { in: ids } },
    select: { id: true, nombre: true, usuario: true, rol: true },
  });
  return new Map(
    empleados.map((e) => [e.id.toString(), { nombre: e.nombre, usuario: e.usuario, rol: e.rol }])
  );
}

const reporte = (cabeceras: readonly string[], filas: Celda[][]): Reporte => ({ cabeceras, filas });

const idsUnicos = (ids: bigint[]) => [...new Set(ids.map((i) => i.toString()))].map((i) => BigInt(i));

async function reporteUsuario(sucursalId: bigint, { inicio, fin }: Rango): Promise<Reporte> {
  const ventas = await prisma.historialVentas.findMany({
    where: { sucursal_id: sucursalId, fecha_venta: { gte: inicio, lt: fin } },
    select: { empleado_id: true, pedido_id: true, cantidad: true, venta_total: true, costo_total: true },
  });
  const empleados = await cargarEmpleados(idsUnicos(ventas.map((v) => v.empleado_id)));
  return reporte(CABECERAS_USUARIO, filasPorUsuario(ventas, empleados));
}

async function reporteProductoResumen(sucursalId: bigint, { inicio, fin }: Rango): Promise<Reporte> {
  const ventas = await prisma.historialVentas.findMany({
    where: { sucursal_id: sucursalId, fecha_venta: { gte: inicio, lt: fin } },
    select: {
      producto_id: true,
      producto_nombre: true,
      sku_producto: true,
      categoria: true,
      cantidad: true,
      venta_total: true,
      costo_total: true,
      costo_teorico_total: true,
    },
  });
  return reporte(CABECERAS_PRODUCTO_RESUMEN, filasProductoResumen(ventas));
}

async function reporteProductoDetalle(
  sucursalId: bigint,
  { inicio, fin }: Rango,
  tz: string,
  limite?: number
): Promise<Reporte> {
  const where = { sucursal_id: sucursalId, fecha_venta: { gte: inicio, lt: fin } };
  const [ventas, total] = await Promise.all([
    prisma.historialVentas.findMany({
      where,
      orderBy: [{ fecha_venta: "asc" }, { id: "asc" }],
      take: limite,
    }),
    limite === undefined ? undefined : prisma.historialVentas.count({ where }),
  ]);
  const empleados = await cargarEmpleados(idsUnicos(ventas.map((v) => v.empleado_id)));
  return { ...reporte(CABECERAS_PRODUCTO_DETALLE, filasProductoDetalle(ventas, empleados, tz)), total };
}

async function reporteCaja(sucursalId: bigint, { inicio, fin }: Rango, tz: string): Promise<Reporte> {
  const cajas = await prisma.caja.findMany({
    where: { sucursal_id: sucursalId, fecha_apertura: { gte: inicio, lt: fin } },
    include: { empleado: { select: { nombre: true } } },
    orderBy: { fecha_apertura: "asc" },
  });
  const ids = cajas.map((c) => c.id);
  const [facturas, movimientos] = await Promise.all([
    prisma.factura.findMany({
      where: { pedido: { caja_id: { in: ids }, estado: "PAGADO" } },
      select: { importe_total: true, metodo_pago: true, pedido: { select: { caja_id: true } } },
    }),
    prisma.movimientoCaja.findMany({
      where: { caja_id: { in: ids }, origen: "MANUAL" },
      select: { caja_id: true, tipo: true, monto: true },
    }),
  ]);
  return reporte(
    CABECERAS_CAJA,
    filasPorCaja(
      cajas.map((c) => ({ ...c, cajero: c.empleado.nombre })),
      facturas.map((f) => ({
        caja_id: f.pedido.caja_id,
        metodo_pago: f.metodo_pago,
        importe_total: f.importe_total,
      })),
      movimientos,
      tz
    )
  );
}

async function reporteAnuladas(sucursalId: bigint, { inicio, fin }: Rango, tz: string): Promise<Reporte> {
  const pedidos = await prisma.pedido.findMany({
    where: { sucursal_id: sucursalId, estado: "ANULADO", creado_en: { gte: inicio, lt: fin } },
    include: {
      empleado: { select: { nombre: true } },
      caja: { select: { empleado: { select: { nombre: true } } } },
      factura: { select: { id: true, metodo_pago: true, importe_total: true } },
    },
    orderBy: { creado_en: "asc" },
  });
  return reporte(
    CABECERAS_ANULADAS,
    filasAnuladas(
      pedidos.map((p) => ({
        ...p,
        tomado_por: p.empleado.nombre,
        cajero: p.caja?.empleado.nombre ?? null,
      })),
      tz
    )
  );
}

export async function GET(req: Request) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;
    const sucursalId = BigInt(sesion.sucursalId);

    const { searchParams } = new URL(req.url);
    const tipo = parseTipoReporte(searchParams.get("tipo"));
    if (!tipo) {
      return NextResponse.json({ message: "Tipo de reporte inválido." }, { status: 400 });
    }

    const tz = obtenerZonaMrp();
    const rango = parseRangoFechas(searchParams.get("desde"), searchParams.get("hasta"), tz);

    const formato = parseFormatoReporte(searchParams.get("formato"));

    let datos: Reporte;
    switch (tipo) {
      case "usuario":
        datos = await reporteUsuario(sucursalId, rango);
        break;
      case "producto-resumen":
        datos = await reporteProductoResumen(sucursalId, rango);
        break;
      case "producto-detalle":
        datos = await reporteProductoDetalle(sucursalId, rango, tz, formato === "json" ? LIMITE_VISTA_PREVIA : undefined);
        break;
      case "caja":
        datos = await reporteCaja(sucursalId, rango, tz);
        break;
      case "anuladas":
        datos = await reporteAnuladas(sucursalId, rango, tz);
        break;
    }

    if (formato === "json") {
      const vista = recortarVistaPrevia(datos.filas, datos.total);
      return NextResponse.json({ cabeceras: datos.cabeceras, ...vista }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }

    return new NextResponse(generarCSV(datos.cabeceras, datos.filas), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="reporte_${tipo}_${rango.desde}_${rango.hasta}.csv"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    if (error instanceof ReporteVentasError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return errorResponse(error, "Error al generar el reporte de ventas");
  }
}
