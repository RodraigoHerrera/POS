import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { errorResponse } from '@/lib/apiError';
import { requireEmpleado, esRespuestaError } from '@/lib/auth';
import {
  calcularFlagsKardex,
  cargarEstadoEdicionLotes,
  lotesCandidatos,
} from '@/lib/kardexEditabilidad';

export async function GET(req: Request) {
  try {
    // 1. Validar Sesión y rol
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;
    const sucursalId = sesion.sucursalId;

    // 2. Obtener parámetros de filtrado opcionales de la URL (Query Params)
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50'); // Límite por defecto
    const itemId = searchParams.get('itemId'); // Filtrar por un item específico si se desea

    // 3. Consultar el Kardex (MovimientoInventario)
    const movimientos = await prisma.movimientoInventario.findMany({
      where: {
        sucursal_id: BigInt(sucursalId),
        tipo: 'Entrada', // FILTRO SOLICITADO: Solo Entradas
        ...(itemId && { item_id: BigInt(itemId) }), // Filtro opcional por item
      },
      take: limit,
      orderBy: {
        creado_en: 'desc', // Lo más reciente primero
      },
      include: {
        item: {
          select: {
            nombre: true,
            sku: true,
            unidad_code: true
          }
        },
        lote: {
          select: {
            codigo_lote: true,
            fecha_caducidad: true
          }
        }
      }
    });

    // 4. Flags de edicion (3 consultas por lotes, sin N+1)
    const estadoLotes = await cargarEstadoEdicionLotes(
      prisma,
      BigInt(sucursalId),
      lotesCandidatos(
        movimientos.map(m => ({ tipo: m.tipo, motivo: m.motivo, loteId: m.lote_id }))
      )
    );

    // 5. Formatear la respuesta (Serializar BigInt y Fechas)
    const kardexFormateado = movimientos.map(mov => {
      const flags = calcularFlagsKardex(
        {
          id: mov.id,
          tipo: mov.tipo,
          motivo: mov.motivo,
          loteId: mov.lote_id,
          cantidad: parseFloat(mov.cantidad.toString()),
        },
        mov.lote_id ? estadoLotes.get(mov.lote_id.toString()) : undefined
      );
      return {
      id: mov.id.toString(),
      fecha: mov.creado_en.toISOString(),
      item: mov.item.nombre,
      sku: mov.item.sku || 'S/N',
      unidad: mov.item.unidad_code,
      
      // Detalles del movimiento
      tipo: mov.tipo,
      motivo: mov.motivo, // Compra, Ajuste, etc.
      referencia: mov.referencia || '-',
      
      // Datos Cuantitativos
      cantidad: parseFloat(mov.cantidad.toString()),
      costo_unitario: mov.costo_unit ? parseFloat(mov.costo_unit.toString()) : 0,
      total_movimiento: (parseFloat(mov.cantidad.toString()) * (mov.costo_unit ? parseFloat(mov.costo_unit.toString()) : 0)).toFixed(2),
      
      // Datos de Lote
      lote: mov.lote?.codigo_lote || 'Sin Lote',
      vencimiento: mov.lote?.fecha_caducidad ? mov.lote.fecha_caducidad.toISOString().split('T')[0] : 'N/A',

      // Datos para edicion
      lote_id: mov.lote_id ? mov.lote_id.toString() : null,
      referencia_original: mov.referencia,
      fecha_caducidad: mov.lote?.fecha_caducidad ? mov.lote.fecha_caducidad.toISOString().split('T')[0] : null,
      editable: flags.editable,
      cantidad_costo_editables: flags.cantidadCostoEditables,
      };
    });

    return NextResponse.json({
      success: true,
      data: kardexFormateado
    });

  } catch (error: any) {
    return errorResponse(error, "Error al consultar el kardex");
  }
}