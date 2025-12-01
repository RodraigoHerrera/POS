"use client";
import Image from "next/image";
import Badge from "@/components/ui/badge/Badge";

// --- Interfaces ---
interface InventoryItem {
  id: number;
  nombre: string;
  precio: string;
  estado: string;
  categoria: string;
  descripcion: string;
  fotoUrl?: string;
}

interface InventoryItemCardProps {
  itemData: InventoryItem;
  onSaved?: (updatedItem: InventoryItem) => void;
}

export default function ProductosCard({ itemData }: InventoryItemCardProps) {

  // ---- UI Components Helpers ----
  const StatusBadge = ({ estado }: { estado: string }) => {
    const isActive = estado.toLowerCase() === 'activo';
    return (
      <Badge variant="light" color={isActive ? "success" : "error"}>
        {isActive ? "Activo" : "Inactivo"}
      </Badge>
    );
  };

  return (
    <div className="group w-full rounded-[20px] border bg-gray-100 p-4 transition-all hover:shadow-lg dark:bg-gray-dark dark:border-gray-700">
      
      {/* Contenedor Flex en Columna para centrar todo */}
      <div className="flex flex-col items-center">
        
        {/* --- IMAGEN (Centrada y Grande) --- */}
        <div className="relative mb-2 h-30 w-30 shrink-0 overflow-hidden rounded-2xl bg-white border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
          {itemData.fotoUrl ? (
            <Image
              width={200}
              height={200}
              src={itemData.fotoUrl}
              alt={itemData.nombre}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-300">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="64" 
                height="64" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <rect width="20" height="14" x="2" y="3" rx="2"/>
                <line x1="8" x2="16" y1="21" y2="21"/>
                <line x1="12" x2="12" y1="17" y2="21"/>
              </svg>
            </div>
          )}
        </div>

        {/* --- INFORMACIÓN --- */}
        <div className="flex w-full flex-col items-center text-center">
          
          {/* Título */}
          <h4 className="mb-2 text-lg font-bold leading-tight text-gray-900 line-clamp-2 dark:text-white">
            {itemData.nombre}
          </h4>

          {/* Precio */}
          <div className="mb-3 text-xl font-bold text-gray-900 dark:text-white">
            Bs. {itemData.precio}
          </div>

        </div>
      </div>
    </div>
  );
}