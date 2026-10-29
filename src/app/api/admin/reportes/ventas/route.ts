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
  parseRangoFechas,
  parseTipoReporte,
  type EmpleadoInfo,
} from "@/lib/reporteVentas";

export const dynamic = "force-dynamic";

type Rango = { inicio: Date; fin: Date };

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

const idsUnicos = (ids: bigint[]) => [...new Set(ids.map((i) => i.toString()))].map((i) => BigInt(i));

async function reporteUsuario(sucursalId: bigint, { inicio, fin }: Rango) {
  const ventas = await prisma.historialVentas.findMany({
    where: { sucursal_id: sucursalId, fecha_venta: { gte: inicio, lt: fin } },
    select: { empleado_id: true, pedido_id: true, cantidad: true, venta_total: true, costo_total: true },
  });
  const empleados = await cargarEmpleados(idsUnicos(ventas.map((v) => v.empleado_id)));
  return generarCSV(CABECERAS_USUARIO, filasPorUsuario(ventas, empleados));
}

async function reporteProductoResumen(sucursalId: bigint, { inicio, fin }: Rango) {
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
  return generarCSV(CABECERAS_PRODUCTO_RESUMEN, filasProductoResumen(ventas));
}

async function reporteProductoDetalle(sucursalId: bigint, { inicio, fin }: Rango, tz: string) {
  const ventas = await prisma.historialVentas.findMany({
    where: { sucursal_id: sucursalId, fecha_venta: { gte: inicio, lt: fin } },
    orderBy: [{ fecha_venta: "asc" }, { id: "asc" }],
  });
  const empleados = await cargarEmpleados(idsUnicos(ventas.map((v) => v.empleado_id)));
  return generarCSV(CABECERAS_PRODUCTO_DETALLE, filasProductoDetalle(ventas, empleados, tz));
}

async function reporteCaja(sucursalId: bigint, { inicio, fin }: Rango, tz: string) {
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
  return generarCSV(
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

async function reporteAnuladas(sucursalId: bigint, { inicio, fin }: Rango, tz: string) {
  const pedidos = await prisma.pedido.findMany({
    where: { sucursal_id: sucursalId, estado: "ANULADO", creado_en: { gte: inicio, lt: fin } },
    include: {
      empleado: { select: { nombre: true } },
      caja: { select: { empleado: { select: { nombre: true } } } },
      factura: { select: { id: true, metodo_pago: true, importe_total: true } },
    },
    orderBy: { creado_en: "asc" },
  });
  return generarCSV(
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

    let csv: string;
    switch (tipo) {
      case "usuario":
        csv = await reporteUsuario(sucursalId, rango);
        break;
      case "producto-resumen":
        csv = await reporteProductoResumen(sucursalId, rango);
        break;
      case "producto-detalle":
        csv = await reporteProductoDetalle(sucursalId, rango, tz);
        break;
      case "caja":
        csv = await reporteCaja(sucursalId, rango, tz);
        break;
      case "anuladas":
        csv = await reporteAnuladas(sucursalId, rango, tz);
        break;
    }

    return new NextResponse(csv, {
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
