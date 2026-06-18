import React from "react";
import { Skeleton } from "./Skeleton";

/**
 * Fila de tabla con celdas en "esqueleto". Útil para tablas que muestran
 * datos cargados desde la API (Kardex, listados de items, etc.).
 */
export default function TableRowSkeleton({ columns }: { columns: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}
