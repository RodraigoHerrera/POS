import React from "react";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Bloque base de "esqueleto" animado. Combínalo con clases de tamaño
 * (w-*, h-*, rounded-*) para construir placeholders de cualquier forma.
 */
export function Skeleton({ className = "", style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200 dark:bg-gray-700 ${className}`}
      style={style}
    />
  );
}
