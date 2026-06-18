/**
 * Recursively converts BigInt values to strings so the result can be
 * passed to NextResponse.json() / JSON.stringify(), which cannot
 * serialize BigInt natively. Non-plain objects (Date, Prisma.Decimal, etc.)
 * are left untouched since they already serialize correctly via toJSON().
 */
export function serializeBigInt<T>(value: T): T {
  if (typeof value === "bigint") {
    return value.toString() as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeBigInt(item)) as unknown as T;
  }

  if (value !== null && typeof value === "object") {
    if (value.constructor !== Object) {
      return value;
    }

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = serializeBigInt(val);
    }
    return result as T;
  }

  return value;
}
