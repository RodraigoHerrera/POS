"use client";

import { useState } from "react";
import { toast } from "sonner";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import { mensajeErrorApi } from "@/lib/respuestaApi";

export interface EntradaEditable {
  id: string;
  item: string;
  motivo: string;
  unidad: string;
  cantidad: number;
  costo_unitario: number;
  lote: string;
  referencia_original: string | null;
  fecha_caducidad: string | null;
  cantidad_costo_editables: boolean;
}

type Props = {
  entrada: EntradaEditable;
  onSaved: () => void;
  onCancel: () => void;
};

export default function EditarEntradaForm({ entrada, onSaved, onCancel }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  // Initial state derived once from props; the parent resets it through `key`.
  const [form, setForm] = useState(() => ({
    codigo_lote: entrada.lote,
    fecha_caducidad: entrada.fecha_caducidad ?? "",
    referencia: entrada.referencia_original ?? "",
    cantidad: String(entrada.cantidad),
    costo_unit: String(entrada.costo_unitario),
  }));

  const handleText =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));

  const save = async () => {
    try {
      setIsSaving(true);
      const body: Record<string, unknown> = {
        codigo_lote: form.codigo_lote,
        fecha_caducidad: form.fecha_caducidad === "" ? null : form.fecha_caducidad,
        referencia: form.referencia,
      };
      if (entrada.cantidad_costo_editables) {
        body.cantidad = Number(form.cantidad);
        body.costo_unit = Number(form.costo_unit);
      }

      const res = await fetch(`/api/inventarios/entradas/${entrada.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(mensajeErrorApi(data, "No se pudo guardar la entrada"));
        return;
      }
      if (data?.sinCambios) {
        toast.info("No hubo cambios para guardar");
        return;
      }
      toast.success("Entrada actualizada");
      onSaved();
    } catch (error) {
      console.error(error);
      toast.error("Error de conexión al guardar la entrada");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="flex flex-col" onSubmit={(e) => e.preventDefault()}>
      <div className="px-2 pr-14 mb-6">
        <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
          Editar entrada
        </h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {entrada.item} · {entrada.motivo}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 px-2 lg:grid-cols-2">
        <div>
          <Label className="text-black">Código de lote</Label>
          <Input
            type="text"
            value={form.codigo_lote}
            onChange={handleText("codigo_lote")}
          />
        </div>
        <div>
          <Label className="text-black">Fecha de vencimiento</Label>
          <Input
            type="date"
            value={form.fecha_caducidad}
            onChange={handleText("fecha_caducidad")}
          />
        </div>
        <div>
          <Label className="text-black">Cantidad ({entrada.unidad})</Label>
          <Input
            type="number"
            step="any"
            value={form.cantidad}
            onChange={handleText("cantidad")}
            disabled={!entrada.cantidad_costo_editables}
          />
        </div>
        <div>
          <Label className="text-black">Costo unitario</Label>
          <Input
            type="number"
            step="any"
            value={form.costo_unit}
            onChange={handleText("costo_unit")}
            disabled={!entrada.cantidad_costo_editables}
          />
        </div>
        {!entrada.cantidad_costo_editables && (
          <p className="text-xs text-gray-500 dark:text-gray-400 lg:col-span-2">
            El lote ya tuvo movimientos; la cantidad y el costo no se pueden modificar.
          </p>
        )}
        <div className="lg:col-span-2">
          <Label className="text-black">Referencia</Label>
          <Input
            type="text"
            value={form.referencia}
            onChange={handleText("referencia")}
            placeholder="Factura #123, Recibo #456..."
          />
        </div>
      </div>

      <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button size="sm" onClick={save} disabled={isSaving}>
          {isSaving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
