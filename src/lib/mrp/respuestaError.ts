import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/apiError";
import { ValidationError, validationErrorResponse } from "@/lib/validation";
import { CorridaRecienteError } from "./corridaReciente";

/** Mapea los errores conocidos del MRP a su respuesta HTTP: 409, 400 o 500 genérico. */
export function respuestaDeError(error: unknown, mensajeGenerico: string): NextResponse {
  if (error instanceof CorridaRecienteError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof ValidationError) {
    return validationErrorResponse(error);
  }
  return errorResponse(error, mensajeGenerico);
}
