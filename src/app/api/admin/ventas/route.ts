import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";
import { serializeBigInt } from "@/lib/serialize";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import { EstadoPedido, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;
    const sucursalId = BigInt(sesion.sucursalId);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "15", 10)));
    const skip = (page - 1) * limit;

    const desde = searchParams.get("desde");
    const hasta = searchParams.get("hasta");
    const estadoParam = searchParams.get("estado");
    const q = searchParams.get("q")?.trim();

    // Base filter conditions (branch scoped)
    const baseConditions: Prisma.pedidoWhereInput[] = [
      { sucursal_id: sucursalId },
    ];

    if (desde) {
      const fechaDesde = new Date(`${desde}T00:00:00`);
      if (!isNaN(fechaDesde.getTime())) {
        baseConditions.push({ creado_en: { gte: fechaDesde } });
      }
    }

    if (hasta) {
      const fechaHasta = new Date(`${hasta}T23:59:59.999`);
      if (!isNaN(fechaHasta.getTime())) {
        baseConditions.push({ creado_en: { lte: fechaHasta } });
      }
    }

    if (q) {
      const orClauses: Prisma.pedidoWhereInput[] = [
        { cliente_nombre: { contains: q } },
        { factura: { is: { razon_social: { contains: q } } } },
        { factura: { is: { nit: { contains: q } } } },
      ];

      if (/^\d+$/.test(q)) {
        try {
          const num = BigInt(q);
          orClauses.push({ id: num });
          orClauses.push({ factura: { is: { id: num } } });
        } catch {}
      }

      baseConditions.push({ OR: orClauses });
    }

    // Where for sales listing: applies estado filter if specified
    const listConditions = [...baseConditions];
    if (estadoParam && estadoParam !== "TODOS") {
      if (Object.values(EstadoPedido).includes(estadoParam as EstadoPedido)) {
        listConditions.push({ estado: estadoParam as EstadoPedido });
      }
    }

    const listWhere: Prisma.pedidoWhereInput = {
      AND: listConditions,
    };

    // Execute list query, count, and KPI calculations in parallel
    const [pedidos, totalRecords, pagadosCount, anuladosCount, pagadosParaKpis] = await Promise.all([
      prisma.pedido.findMany({
        where: listWhere,
        include: {
          factura: true,
          empleado: { select: { id: true, nombre: true } },
          items: {
            include: {
              producto: { select: { id: true, nombre: true, categoria: true } },
              extras: true,
            },
          },
        },
        orderBy: { creado_en: "desc" },
        skip,
        take: limit,
      }),
      prisma.pedido.count({ where: listWhere }),
      prisma.pedido.count({
        where: {
          AND: [...baseConditions, { estado: EstadoPedido.PAGADO }],
        },
      }),
      prisma.pedido.count({
        where: {
          AND: [...baseConditions, { estado: EstadoPedido.ANULADO }],
        },
      }),
      prisma.pedido.findMany({
        where: {
          AND: [...baseConditions, { estado: EstadoPedido.PAGADO }],
        },
        select: {
          total: true,
          items: {
            select: {
              costo_real: true,
            },
          },
        },
      }),
    ]);

    let totalFacturado = 0;
    let totalCosto = 0;
    for (const p of pagadosParaKpis) {
      totalFacturado += Number(p.total);
      for (const item of p.items) {
        totalCosto += Number(item.costo_real ?? 0);
      }
    }

    const margenPromedioPct = totalFacturado > 0
      ? Math.round(((totalFacturado - totalCosto) / totalFacturado) * 10000) / 100
      : 0;

    return NextResponse.json(
      serializeBigInt({
        success: true,
        data: pedidos,
        pagination: {
          page,
          limit,
          total: totalRecords,
          totalPages: Math.ceil(totalRecords / limit),
        },
        kpis: {
          totalFacturado,
          totalPagados: pagadosCount,
          totalAnulados: anuladosCount,
          margenPromedioPct,
        },
      })
    );
  } catch (error: any) {
    return errorResponse(error, "Error al listar las ventas");
  }
}
