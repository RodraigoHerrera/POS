import { NextResponse } from "next/server";

export class ValidationError extends Error {
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export function validationErrorResponse(error: unknown): NextResponse {
  let msg = "Error de validación";
  if (error instanceof ValidationError || error instanceof Error) {
    msg = error.message;
  } else if (typeof error === "string") {
    msg = error;
  }
  return NextResponse.json(
    { error: msg, message: msg },
    { status: 400 }
  );
}

export function parseNonNegativeNumber(value: unknown, fieldName = "Valor"): number {
  if (value === null || value === undefined || typeof value === "boolean") {
    throw new ValidationError(`${fieldName} debe ser un número válido mayor o igual a 0`, fieldName);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      throw new ValidationError(`${fieldName} no puede estar vacío`, fieldName);
    }
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num < 0) {
      throw new ValidationError(`${fieldName} debe ser un número mayor o igual a 0`, fieldName);
    }
    return Object.is(num, -0) ? 0 : num;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new ValidationError(`${fieldName} debe ser un número mayor o igual a 0`, fieldName);
    }
    return Object.is(value, -0) ? 0 : value;
  }

  throw new ValidationError(`${fieldName} debe ser un número válido mayor o igual a 0`, fieldName);
}

export function parsePositiveNumber(value: unknown, fieldName = "Valor"): number {
  if (value === null || value === undefined || typeof value === "boolean") {
    throw new ValidationError(`${fieldName} debe ser un número válido mayor a 0`, fieldName);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      throw new ValidationError(`${fieldName} no puede estar vacío`, fieldName);
    }
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num <= 0) {
      throw new ValidationError(`${fieldName} debe ser un número mayor a 0`, fieldName);
    }
    return num;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      throw new ValidationError(`${fieldName} debe ser un número mayor a 0`, fieldName);
    }
    return value;
  }

  throw new ValidationError(`${fieldName} debe ser un número válido mayor a 0`, fieldName);
}

export function parsePositiveInt(value: unknown, fieldName = "Valor"): number {
  if (value === null || value === undefined || typeof value === "boolean") {
    throw new ValidationError(`${fieldName} debe ser un entero positivo`, fieldName);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      throw new ValidationError(`${fieldName} no puede estar vacío`, fieldName);
    }
    if (!/^\d+$/.test(trimmed)) {
      throw new ValidationError(`${fieldName} debe ser un entero positivo`, fieldName);
    }
    const num = Number(trimmed);
    if (!Number.isSafeInteger(num) || num <= 0) {
      throw new ValidationError(`${fieldName} debe ser un entero positivo`, fieldName);
    }
    return num;
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new ValidationError(`${fieldName} debe ser un entero positivo`, fieldName);
    }
    return value;
  }

  throw new ValidationError(`${fieldName} debe ser un entero positivo`, fieldName);
}

export function parsePositiveBigInt(value: unknown, fieldName = "ID"): bigint {
  if (value === null || value === undefined || typeof value === "boolean") {
    throw new ValidationError(`${fieldName} es obligatorio y debe ser un entero positivo`, fieldName);
  }

  if (typeof value === "bigint") {
    if (value <= BigInt(0)) {
      throw new ValidationError(`${fieldName} debe ser mayor a 0`, fieldName);
    }
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new ValidationError(`${fieldName} debe ser un entero positivo`, fieldName);
    }
    return BigInt(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      throw new ValidationError(`${fieldName} no puede estar vacío`, fieldName);
    }
    if (!/^\d+$/.test(trimmed)) {
      throw new ValidationError(`${fieldName} debe ser un entero positivo`, fieldName);
    }
    try {
      const b = BigInt(trimmed);
      if (b <= BigInt(0)) {
        throw new ValidationError(`${fieldName} debe ser mayor a 0`, fieldName);
      }
      return b;
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new ValidationError(`${fieldName} debe ser un entero positivo`, fieldName);
    }
  }

  throw new ValidationError(`${fieldName} debe ser un entero positivo`, fieldName);
}

export interface ValidatedModificador {
  itemId: bigint;
  cantidad: number;
  precio: number;
}

export function validateModificadores(rawModificadores: unknown): ValidatedModificador[] {
  if (rawModificadores === undefined || rawModificadores === null) {
    return [];
  }

  if (!Array.isArray(rawModificadores)) {
    throw new ValidationError("Los modificadores deben ser un arreglo", "modificadores");
  }

  return rawModificadores.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new ValidationError(`Modificador en posición ${index} debe ser un objeto`, "modificadores");
    }

    const raw = item as Record<string, unknown>;
    const itemId = parsePositiveBigInt(raw.itemId, `itemId en modificador [${index}]`);
    const cantidad = parsePositiveNumber(raw.cantidad, `cantidad en modificador [${index}]`);
    let precio = 0;
    if (raw.precio !== undefined && raw.precio !== null && raw.precio !== "") {
      precio = parseNonNegativeNumber(raw.precio, `precio en modificador [${index}]`);
    }

    return { itemId, cantidad, precio };
  });
}

export interface ValidatedRecetaItem {
  itemId: bigint;
  cantidad: number;
  merma_pct: number;
}

export function validateReceta(rawReceta: unknown): ValidatedRecetaItem[] {
  if (rawReceta === undefined || rawReceta === null) {
    return [];
  }

  if (!Array.isArray(rawReceta)) {
    throw new ValidationError("La receta debe ser un arreglo", "receta");
  }

  return rawReceta.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new ValidationError(`Insumo en posición ${index} debe ser un objeto`, "receta");
    }

    const raw = item as Record<string, unknown>;
    const itemId = parsePositiveBigInt(raw.itemId, `itemId en receta [${index}]`);
    const cantidad = parsePositiveNumber(raw.cantidad, `cantidad en receta [${index}]`);

    return {
      itemId,
      cantidad,
      merma_pct: 0,
    };
  });
}
