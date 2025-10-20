"use client";
import React from "react";

import { ApexOptions } from "apexcharts";

import dynamic from "next/dynamic";
// Dynamically import the ReactApexChart component
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

export default function BarChartOne() {
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
      categories: [
        "Carne",
        "Queso",
        "Pan",
        "Papas",
        "Tocino",
        "Bebidas",
        "Vegetales",
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
  const series = [
    {
      name: "Unidades en Inventario",
      data: [168, 385, 201, 298, 187, 195, 291],
    },
  ];
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
