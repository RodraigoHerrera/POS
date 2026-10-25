import React from "react";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import PrintButton from "./PrintButton";

export default async function ComandaPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  let pedidoId;
  try {
    pedidoId = BigInt(id);
  } catch {
    notFound();
  }

  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: {
      empleado: true,
      items: {
        include: {
          producto: true,
          extras: true,
        },
      },
    },
  });

  if (!pedido) {
    notFound();
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 py-8 print:bg-white print:py-0 print:min-h-0">
      <div className="mb-4 print:hidden flex gap-4">
        <PrintButton />
      </div>

      <div className="bg-white p-4 shadow-sm max-w-[80mm] w-full text-black font-mono text-sm print:shadow-none print:p-0 print:m-0 print:max-w-none">
        <div className="text-center mb-4">
          <h1 className="font-bold text-lg mb-1">SMASH POS</h1>
          <p className="text-xs">Comanda / Orden de Preparación</p>
          <p className="text-xs">Fecha: {pedido.creado_en.toLocaleString("es-MX")}</p>
          <p className="text-xs">Pedido: #{pedido.id.toString()}</p>
          <p className="text-xs">Atiende: {pedido.empleado?.nombre || "N/A"}</p>
        </div>

        <div className="mb-4 text-sm">
          <p><strong>Mesa:</strong> {pedido.mesa || "N/A"}</p>
          <p><strong>Cliente:</strong> {pedido.cliente_nombre || "Mostrador"}</p>
        </div>

        <div className="border-t border-b border-black py-2 mb-4">
          <table className="w-full text-left table-fixed">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1 w-8">C</th>
                <th className="py-1">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {pedido.items.map((item) => (
                <React.Fragment key={item.id.toString()}>
                  <tr>
                    <td className="align-top py-1 font-bold">{item.cantidad}</td>
                    <td className="align-top py-1">
                      <span className="font-bold">{item.producto.nombre}</span>
                      {item.notas && (
                        <div className="text-xs italic mt-0.5">* {item.notas}</div>
                      )}
                      {item.extras.length > 0 && (
                        <div className="text-xs mt-0.5 ml-2">
                          {item.extras.map((extra) => (
                            <div key={extra.id.toString()}>+ {extra.nombre}</div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {pedido.observaciones && (
          <div className="mb-4 text-sm border border-black p-2">
            <strong>Notas del pedido:</strong>
            <p>{pedido.observaciones}</p>
          </div>
        )}

        <div className="text-center mt-6 text-xs">
          <p>-- Fin de Comanda --</p>
        </div>
      </div>
    </div>
  );
}
