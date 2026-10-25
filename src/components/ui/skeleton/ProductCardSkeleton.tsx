import React from "react";
import { Skeleton } from "./Skeleton";

/**
 * Placeholder de una tarjeta de producto (catálogo de menú / ventas).
 * Reproduce las dimensiones de ProductosCard / ProductCard.
 */
export default function ProductCardSkeleton() {
  return (
    <div className="w-full rounded-[20px] border bg-gray-100 dark:bg-gray-dark p-5 dark:border-gray-700">
      <div className="flex gap-4 mb-4">
        <Skeleton className="h-[84px] w-[84px] shrink-0 rounded-2xl" />
        <div className="flex w-full flex-col gap-3 pt-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}
