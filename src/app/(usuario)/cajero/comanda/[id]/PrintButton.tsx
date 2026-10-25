"use client";

import React, { useEffect } from "react";

export default function PrintButton() {
  // Opcional: imprimir automáticamente al cargar
  useEffect(() => {
    // window.print();
  }, []);

  return (
    <>
      <button
        onClick={() => window.print()}
        className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition-colors"
      >
        Imprimir Comanda
      </button>
      <button
        onClick={() => window.close()}
        className="px-4 py-2 bg-gray-300 text-black rounded shadow hover:bg-gray-400 transition-colors"
      >
        Cerrar
      </button>
    </>
  );
}
