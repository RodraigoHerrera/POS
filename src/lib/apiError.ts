import { NextResponse } from "next/server";

/**
 * Logs the original error server-side and returns a sanitized JSON response,
 * so internal details (stack traces, query info, etc.) never reach the client.
 */
export function errorResponse(
  error: unknown,
  message = "Error interno del servidor",
  status = 500
) {
  console.error(error);
  return NextResponse.json({ error: message }, { status });
}
