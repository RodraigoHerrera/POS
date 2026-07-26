"use client";

import React, { useState } from "react";
import { executeProductionBatch, ProductionBatchInput } from "@/app/actions/produccion";

type Props = {
  recipes: Array<{ id: string; name: string }>;
  sucursales: Array<{ id: string; name: string }>;
};

export default function ProductionClient({ recipes, sucursales }: Props) {
  const [recipeId, setRecipeId] = useState<string>("");
  const [sucursalId, setSucursalId] = useState<string>(
    sucursales.length > 0 ? sucursales[0].id : ""
  );
  const [quantity, setQuantity] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeId || !sucursalId || quantity === "" || Number(quantity) <= 0) {
      setMessage({ text: "Por favor complete todos los campos correctamente.", type: "error" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const input: ProductionBatchInput = {
        recipeId,
        sucursalId,
        quantity: Number(quantity),
      };

      const result = await executeProductionBatch(input);

      if (result.success) {
        setMessage({ text: result.message, type: "success" });
        setQuantity("");
        setRecipeId("");
      } else {
        setMessage({ text: result.message, type: "error" });
      }
    } catch (error: any) {
      setMessage({ text: error.message || "Error al procesar la producción.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto dark:bg-gray-800">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sucursal
          </label>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            disabled={loading}
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            required
          >
            <option value="" disabled>Seleccione una sucursal</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Receta
          </label>
          <select
            value={recipeId}
            onChange={(e) => setRecipeId(e.target.value)}
            disabled={loading}
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            required
          >
            <option value="" disabled>Seleccione una receta</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Cantidad a Producir
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value ? Number(e.target.value) : "")}
            disabled={loading}
            min="1"
            step="any"
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Ej. 10"
            required
          />
        </div>

        {message && (
          <div
            className={`p-4 rounded-md ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-300"
                : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Procesando..." : "Ejecutar Producción"}
        </button>
      </form>
    </div>
  );
}
