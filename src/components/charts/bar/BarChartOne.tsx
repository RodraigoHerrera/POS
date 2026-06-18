"use client";
import React from "react";
import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useEffect, useState } from 'react';

// Dynamically import the ReactApexChart component
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

interface ItemInventario {
  nombre: string;
  stock: number;
  unidad: string;
  sku: string | null;
}

export default function BarChartOne() {

  const [items, setItems] = useState<ItemInventario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const obtenerDatos = async () => {
      try {
        const respuesta = await fetch('/api/inventarios/inventarioSucursal');

        if (!respuesta.ok) {
          throw new Error('Error al conectar con el servidor');
        }

        const datos: ItemInventario[] = await respuesta.json();
        setItems(datos);
      } catch (err) {
        console.error(err);
        setError('No se pudo cargar el inventario.');
      } finally {
        setCargando(false);
      }
    };

    obtenerDatos();
  }, []);

  // --- NUEVA FUNCIÓN AUXILIAR ---
  // Busca un item que contenga el texto (ej: "Carne") y devuelve su stock.
  // Si no lo encuentra, devuelve 0.
  const buscarStock = (terminoBusqueda: string): number => {
    if (!items || items.length === 0) return 0;

    const itemEncontrado = items.find((item) => 
      item.nombre.toLowerCase().includes(terminoBusqueda.toLowerCase())
    );

    return itemEncontrado ? Number(itemEncontrado.stock) : 0;
  };

  const options: ApexOptions = {
    colors: ["#FF1E00"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      height: 280,
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "39%",
        borderRadius: 5,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 4,
      colors: ["transparent"],
    },
    xaxis: {
      // El orden de estas categorías debe coincidir con el orden de 'series' abajo
      categories: [
        "Carne",
        "Queso",
        "Pan",
        "Papas",
        "Tocino",
        "Bebidas",
      ],
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
      fontFamily: "Outfit",
    },
    yaxis: {
      title: {
        text: undefined,
      },
    },
    grid: {
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    fill: {
      opacity: 1,
    },
    tooltip: {
      x: {
        show: false,
      },
      y: {
        formatter: (val: number) => `${val}`,
      },
    },
  };

  // --- AQUÍ ESTÁ EL CAMBIO SOLICITADO ---
  const series = [
    {
      name: "Porcentaje de Stock",
      data: [
        (buscarStock("Carne")/200)*100,   // 1er valor: busca algo que tenga "Carne" en el nombre
        (buscarStock("Queso")/200)*100,   // 2do valor
        (buscarStock("Pan")/500)*100,     // 3er valor
        (buscarStock("Papa")/70)*100,   // 4to valor
        (buscarStock("Tocino")/160)*100,  // 5to valor
        buscarStock("Bebida"),  // 6to valor (ojo: busca "Bebida" singular para coincidir con plurales)
      ],
    },
  ];

  if (cargando) return <div className="p-4 text-gray-500">Cargando gráfica...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="max-w-full overflow-x-auto custom-scrollbar h-11/12">
      <div id="chartOne" className="min-w-[420px]">
        <ReactApexChart
          options={options}
          series={series}
          type="bar"
          height={309}
        />
      </div>
    </div>
  );
}