import GridShape from "@/components/common/GridShape";
import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";

import { ThemeProvider } from "@/context/ThemeContext";
import Image from "next/image";
import Link from "next/link";
import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <div className="absolute inset-0 -z-10">
        <Image
          src="/background1.png"   /* Ajusta la ruta según tu estructura de archivos */
          alt="Fondo"
          fill        /* Ocupa todo el contenedor */
          style={{ objectFit: "cover" }}
        />
      </div>
        <div className="relative flex items-center justify-center min-h-screen ">
          {children}

          {/* <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
            <ThemeTogglerTwo />
          </div> Cambiar el tema*/}
        </div>
    </div>
  );
}
