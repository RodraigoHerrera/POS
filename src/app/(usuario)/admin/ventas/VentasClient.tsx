"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  DollarSign,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Receipt,
  RotateCw,
  FileSpreadsheet,
} from "lucide-react";
import VentasFilters, { VentasFilterValues } from "./components/VentasFilters";
import VentasTable, { PedidoSaleRecord } from "./components/VentasTable";
import VentaDetalleModal from "./components/VentaDetalleModal";
import AnularVentaModal from "./components/AnularVentaModal";

interface KpiData {
  totalFacturado: number;
  totalPagados: number;
  totalAnulados: number;
  margenPromedioPct: number;
}

export default function VentasClient() {
  const [filters, setFilters] = useState<VentasFilterValues>({
    desde: "",
    hasta: "",
    estado: "TODOS",
    q: "",
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });

  const [kpis, setKpis] = useState<KpiData>({
    totalFacturado: 0,
    totalPagados: 0,
    totalAnulados: 0,
    margenPromedioPct: 0,
  });

  const [pedidos, setPedidos] = useState<PedidoSaleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [detailModalId, setDetailModalId] = useState<string | null>(null);
  const [anularPedido, setAnularPedido] = useState<PedidoSaleRecord | null>(null);

  const fetchVentas = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());
      if (filters.desde) params.set("desde", filters.desde);
      if (filters.hasta) params.set("hasta", filters.hasta);
      if (filters.estado && filters.estado !== "TODOS") params.set("estado", filters.estado);
      if (filters.q) params.set("q", filters.q);

      const res = await fetch(`/api/admin/ventas?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      if (json.success) {
        setPedidos(json.data || []);
        if (json.pagination) {
          setPagination((prev) => ({
            ...prev,
            total: json.pagination.total,
            totalPages: json.pagination.totalPages,
          }));
        }
        if (json.kpis) {
          setKpis(json.kpis);
        }
      }
    } catch (error) {
      console.error("Error al obtener las ventas:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchVentas();
  }, [fetchVentas]);

  const handleFilterChange = (
    updates: Partial<VentasFilterValues & { page: number }>
  ) => {
    if (updates.page !== undefined) {
      setPagination((prev) => ({ ...prev, page: updates.page! }));
    }
    setFilters((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      desde: "",
      hasta: "",
      estado: "TODOS",
      q: "",
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const formatMoney = (val: number) => {
    return `Bs ${val.toLocaleString("es-BO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Receipt className="h-6 w-6 text-brand-500" />
            Gestión de Ventas y Facturación
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Auditoría de comandas, comprobantes fiscales, costeo real FEFO y control de anulaciones
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchVentas()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-750 transition"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Facturado */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              Total Facturado (Pagado)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
            {formatMoney(kpis.totalFacturado)}
          </div>
          <p className="mt-1 text-xs text-gray-400">Ventas netas cobradas en el periodo</p>
        </div>

        {/* Total Pagados */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              Comandas Pagadas
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
            {kpis.totalPagados}
          </div>
          <p className="mt-1 text-xs text-gray-400">Órdenes cerradas y liquidadas</p>
        </div>

        {/* Total Anulados */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              Comandas Anuladas
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400">
              <XCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-error-600 dark:text-error-400">
            {kpis.totalAnulados}
          </div>
          <p className="mt-1 text-xs text-gray-400">Cancelaciones y devoluciones</p>
        </div>

        {/* Margen Promedio */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              Margen Promedio
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-brand-600 dark:text-brand-400">
            {kpis.margenPromedioPct}%
          </div>
          <p className="mt-1 text-xs text-gray-400">Rentabilidad sobre costo FEFO</p>
        </div>
      </div>

      {/* Filters */}
      <VentasFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
        isLoading={isLoading}
      />

      {/* Sales Table */}
      <VentasTable
        pedidos={pedidos}
        isLoading={isLoading}
        pagination={pagination}
        onPageChange={handlePageChange}
        onViewDetail={(id) => setDetailModalId(id)}
        onAnular={(p) => setAnularPedido(p)}
      />

      {/* Modals */}
      <VentaDetalleModal
        isOpen={Boolean(detailModalId)}
        onClose={() => setDetailModalId(null)}
        pedidoId={detailModalId}
      />

      <AnularVentaModal
        isOpen={Boolean(anularPedido)}
        onClose={() => setAnularPedido(null)}
        pedido={anularPedido}
        onSuccess={() => {
          fetchVentas();
        }}
      />
    </div>
  );
}
