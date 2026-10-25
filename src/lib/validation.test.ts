import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ValidationError,
  validationErrorResponse,
  parseNonNegativeNumber,
  parsePositiveNumber,
  parsePositiveInt,
  parsePositiveBigInt,
  validateModificadores,
  validateReceta,
} from "./validation";
import { POST as cerrarCajaHandler } from "../app/api/caja/cerrar/route";

describe("SEC-11: Domain Validation Module (validation.ts)", () => {
  describe("ValidationError & validationErrorResponse", () => {
    it("creates a ValidationError with proper name, message, and field", () => {
      const err = new ValidationError("El campo es requerido", "precio");
      assert.equal(err.name, "ValidationError");
      assert.equal(err.message, "El campo es requerido");
      assert.equal(err.field, "precio");
      assert.ok(err instanceof Error);
      assert.ok(err instanceof ValidationError);
    });

    it("generates HTTP 400 NextResponse with error and message fields", async () => {
      const err = new ValidationError("Precio inválido", "precio");
      const res = validationErrorResponse(err);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.deepEqual(data, {
        error: "Precio inválido",
        message: "Precio inválido",
      });
    });

    it("handles generic Error instances and string messages", async () => {
      const res1 = validationErrorResponse(new Error("Error genérico"));
      assert.equal(res1.status, 400);
      assert.deepEqual(await res1.json(), {
        error: "Error genérico",
        message: "Error genérico",
      });

      const res2 = validationErrorResponse("Mensaje directo");
      assert.equal(res2.status, 400);
      assert.deepEqual(await res2.json(), {
        error: "Mensaje directo",
        message: "Mensaje directo",
      });
    });
  });

  describe("parseNonNegativeNumber", () => {
    it("accepts valid non-negative numbers and numeric strings", () => {
      assert.equal(parseNonNegativeNumber(0), 0);
      assert.equal(parseNonNegativeNumber(-0), 0);
      assert.equal(parseNonNegativeNumber(10), 10);
      assert.equal(parseNonNegativeNumber(99.99), 99.99);
      assert.equal(parseNonNegativeNumber("0"), 0);
      assert.equal(parseNonNegativeNumber("150.25"), 150.25);
      assert.equal(parseNonNegativeNumber("   42   "), 42);
    });

    it("rejects negative numbers and negative numeric strings", () => {
      assert.throws(() => parseNonNegativeNumber(-0.01), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parseNonNegativeNumber(-1), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parseNonNegativeNumber("-5"), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parseNonNegativeNumber("-0.001"), (err: unknown) => err instanceof ValidationError);
    });

    it("rejects non-finite, NaN, and Infinity", () => {
      assert.throws(() => parseNonNegativeNumber(NaN), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parseNonNegativeNumber(Infinity), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parseNonNegativeNumber(-Infinity), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parseNonNegativeNumber("Infinity"), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parseNonNegativeNumber("NaN"), (err: unknown) => err instanceof ValidationError);
    });

    it("rejects null, undefined, booleans, empty strings, and objects", () => {
      assert.throws(() => parseNonNegativeNumber(null), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parseNonNegativeNumber(undefined), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parseNonNegativeNumber(true), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parseNonNegativeNumber(false), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parseNonNegativeNumber(""), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parseNonNegativeNumber("   "), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parseNonNegativeNumber({}), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parseNonNegativeNumber([]), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parseNonNegativeNumber("abc"), (err: unknown) => err instanceof ValidationError);
    });
  });

  describe("parsePositiveNumber", () => {
    it("accepts strictly positive numbers and numeric strings", () => {
      assert.equal(parsePositiveNumber(0.001), 0.001);
      assert.equal(parsePositiveNumber(1), 1);
      assert.equal(parsePositiveNumber(150.5), 150.5);
      assert.equal(parsePositiveNumber("0.5"), 0.5);
      assert.equal(parsePositiveNumber("999"), 999);
    });

    it("rejects 0 and -0", () => {
      assert.throws(() => parsePositiveNumber(0), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveNumber(-0), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveNumber("0"), (err: unknown) => err instanceof ValidationError);
    });

    it("rejects negative numbers and malformed values", () => {
      assert.throws(() => parsePositiveNumber(-1), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveNumber("-10"), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveNumber(null), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveNumber(undefined), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveNumber(false), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveNumber(true), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveNumber(""), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveNumber("abc"), (err: unknown) => err instanceof ValidationError);
    });
  });

  describe("parsePositiveInt", () => {
    it("accepts safe positive integers and whole number strings", () => {
      assert.equal(parsePositiveInt(1), 1);
      assert.equal(parsePositiveInt(42), 42);
      assert.equal(parsePositiveInt("100"), 100);
      assert.equal(parsePositiveInt("   5   "), 5);
    });

    it("rejects decimals and floating point numbers", () => {
      assert.throws(() => parsePositiveInt(1.5), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveInt(0.1), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveInt("1.5"), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveInt("10.0"), (err: unknown) => err instanceof ValidationError);
    });

    it("rejects 0, negative values, and non-numeric inputs", () => {
      assert.throws(() => parsePositiveInt(0), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveInt("0"), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveInt(-5), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveInt("-5"), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveInt(null), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveInt(undefined), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveInt(true), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveInt("foo"), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveInt(Number.MAX_SAFE_INTEGER + 100), (err: unknown) => err instanceof ValidationError);
    });
  });

  describe("parsePositiveBigInt", () => {
    it("accepts positive integers as number, string, or bigint", () => {
      assert.equal(parsePositiveBigInt(1), BigInt(1));
      assert.equal(parsePositiveBigInt(42), BigInt(42));
      assert.equal(parsePositiveBigInt(BigInt(100)), BigInt(100));
      assert.equal(parsePositiveBigInt("1"), BigInt(1));
      assert.equal(parsePositiveBigInt("9007199254740993"), BigInt("9007199254740993"));
      assert.equal(parsePositiveBigInt("   77   "), BigInt(77));
    });

    it("rejects 0, negative integers, and floats", () => {
      assert.throws(() => parsePositiveBigInt(0), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveBigInt("0"), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveBigInt(BigInt(0)), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveBigInt(-1), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveBigInt("-10"), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveBigInt(BigInt(-5)), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveBigInt(1.5), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveBigInt("1.5"), (err: unknown) => err instanceof ValidationError);
    });

    it("rejects malformed strings and non-primitive inputs without throwing SyntaxError", () => {
      assert.throws(() => parsePositiveBigInt("abc"), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveBigInt(""), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveBigInt("   "), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveBigInt(null), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveBigInt(undefined), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveBigInt(true), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveBigInt(false), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveBigInt({}), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => parsePositiveBigInt([]), (err: unknown) => err instanceof ValidationError);
    });
  });

  describe("validateModificadores", () => {
    it("validates and parses a valid list of modificadores", () => {
      const raw = [
        { itemId: 10, cantidad: 2, precio: 5.5 },
        { itemId: "20", cantidad: "1.5", precio: 0 },
        { itemId: BigInt(30), cantidad: 3 }, // precio defaults to 0
      ];
      const result = validateModificadores(raw);
      assert.deepEqual(result, [
        { itemId: BigInt(10), cantidad: 2, precio: 5.5 },
        { itemId: BigInt(20), cantidad: 1.5, precio: 0 },
        { itemId: BigInt(30), cantidad: 3, precio: 0 },
      ]);
    });

    it("returns empty array when passed empty array, null, or undefined", () => {
      assert.deepEqual(validateModificadores([]), []);
      assert.deepEqual(validateModificadores(null), []);
      assert.deepEqual(validateModificadores(undefined), []);
    });

    it("rejects non-array inputs", () => {
      assert.throws(() => validateModificadores("not-array"), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => validateModificadores(123), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => validateModificadores({ itemId: 1 }), (err: unknown) => err instanceof ValidationError);
    });

    it("rejects non-object items in array", () => {
      assert.throws(() => validateModificadores([null]), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => validateModificadores(["item"]), (err: unknown) => err instanceof ValidationError);
    });

    it("rejects invalid itemId", () => {
      assert.throws(
        () => validateModificadores([{ itemId: 0, cantidad: 1, precio: 5 }]),
        (err: unknown) => err instanceof ValidationError
      );
      assert.throws(
        () => validateModificadores([{ itemId: -5, cantidad: 1, precio: 5 }]),
        (err: unknown) => err instanceof ValidationError
      );
      assert.throws(
        () => validateModificadores([{ itemId: "abc", cantidad: 1, precio: 5 }]),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it("rejects invalid or non-positive cantidad", () => {
      assert.throws(
        () => validateModificadores([{ itemId: 1, cantidad: 0, precio: 5 }]),
        (err: unknown) => err instanceof ValidationError
      );
      assert.throws(
        () => validateModificadores([{ itemId: 1, cantidad: -2, precio: 5 }]),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it("rejects negative precio", () => {
      assert.throws(
        () => validateModificadores([{ itemId: 1, cantidad: 1, precio: -0.5 }]),
        (err: unknown) => err instanceof ValidationError
      );
    });
  });

  describe("validateReceta", () => {
    it("validates and parses a valid list of receta items", () => {
      const raw = [
        { itemId: 5, cantidad: 0.5 },
        { itemId: "12", cantidad: "2" },
      ];
      const result = validateReceta(raw);
      assert.deepEqual(result, [
        { itemId: BigInt(5), cantidad: 0.5, merma_pct: 0 },
        { itemId: BigInt(12), cantidad: 2, merma_pct: 0 },
      ]);
    });

    it("returns empty array for empty array, null, or undefined", () => {
      assert.deepEqual(validateReceta([]), []);
      assert.deepEqual(validateReceta(null), []);
      assert.deepEqual(validateReceta(undefined), []);
    });

    it("rejects non-array inputs", () => {
      assert.throws(() => validateReceta("invalido"), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => validateReceta(42), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => validateReceta({ itemId: 1 }), (err: unknown) => err instanceof ValidationError);
    });

    it("rejects non-object items in array", () => {
      assert.throws(() => validateReceta([null]), (err: unknown) => err instanceof ValidationError);
      assert.throws(() => validateReceta([123]), (err: unknown) => err instanceof ValidationError);
    });

    it("rejects invalid itemId", () => {
      assert.throws(
        () => validateReceta([{ itemId: 0, cantidad: 1 }]),
        (err: unknown) => err instanceof ValidationError
      );
      assert.throws(
        () => validateReceta([{ itemId: "invalido", cantidad: 1 }]),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it("rejects invalid or non-positive cantidad", () => {
      assert.throws(
        () => validateReceta([{ itemId: 1, cantidad: 0 }]),
        (err: unknown) => err instanceof ValidationError
      );
      assert.throws(
        () => validateReceta([{ itemId: 1, cantidad: -1 }]),
        (err: unknown) => err instanceof ValidationError
      );
    });
  });

  describe("Fail-fast route integration: /api/caja/cerrar", () => {
    it("rejects negative totalContado before auth or database transaction", async () => {
      const req = new Request("http://localhost/api/caja/cerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalContado: -50 }),
      });
      const res = await cerrarCajaHandler(req);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes("totalContado"));
      assert.ok(data.message.includes("totalContado"));
    });

    it("rejects missing or malformed totalContado with 400 Bad Request", async () => {
      const req1 = new Request("http://localhost/api/caja/cerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalContado: "invalido" }),
      });
      const res1 = await cerrarCajaHandler(req1);
      assert.equal(res1.status, 400);

      const req2 = new Request("http://localhost/api/caja/cerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res2 = await cerrarCajaHandler(req2);
      assert.equal(res2.status, 400);
    });
  });
});
