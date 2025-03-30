import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title:
    "Smash POS",
  description: "Esta es la vista de reportes de la aplicacion Smash POS para el administrador.",
};

export default function reportes() {
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
    </div>
  );
}
