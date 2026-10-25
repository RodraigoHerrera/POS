import React from "react";
import { Skeleton } from "./Skeleton";

/**
 * Placeholder de una tarjeta de lista (usuarios, recetas).
 * Reproduce las dimensiones de UserMetaCard / RecetasCard.
 */
export default function ListCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex w-full flex-col items-center gap-6 xl:flex-row">
          <Skeleton className="h-20 w-20 shrink-0 rounded-lg" />
          <div className="flex w-full flex-col items-center gap-2 xl:items-start">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <Skeleton className="h-9 w-24 shrink-0 rounded-lg" />
      </div>
    </div>
  );
}
