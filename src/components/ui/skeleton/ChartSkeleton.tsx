import React from "react";
import { Skeleton } from "./Skeleton";

/**
 * Placeholder rectangular para gráficas (ApexCharts) mientras se cargan los datos.
 */
export default function ChartSkeleton({ height = 180 }: { height?: number }) {
  return <Skeleton className="w-full" style={{ height }} />;
}
