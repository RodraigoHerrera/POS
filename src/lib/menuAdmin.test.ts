import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resumenProductos,
  categoriasDeProductos,
  filtrarProductos,
  esProductoActivo,
} from "./menuAdmin";

const productos = [
  { nombre: "Smash Doble", categoria: "Hamburguesas", estado: "activo" },
  { nombre: "Smash Simple", categoria: "Hamburguesas", estado: "Inactivo" },
  { nombre: "Papas Fritas", categoria: "Acompañamientos", estado: "Activo" },
  { nombre: "Coca Cola", categoria: " Bebidas ", estado: "inactivo" },
  { nombre: "Agua", categoria: "", estado: "activo" },
  // categoria es nullable en la base de datos
  { nombre: "Combo Sorpresa", categoria: null, estado: "activo" },
];

describe("esProductoActivo", () => {
  it("is case-insensitive", () => {
    assert.equal(esProductoActivo("Activo"), true);
    assert.equal(esProductoActivo("activo"), true);
    assert.equal(esProductoActivo("inactivo"), false);
    assert.equal(esProductoActivo(""), false);
  });
});

describe("resumenProductos", () => {
  it("returns zeros for an empty list", () => {
    assert.deepEqual(resumenProductos([]), { total: 0, activos: 0, inactivos: 0 });
  });

  it("counts active and inactive products", () => {
    assert.deepEqual(resumenProductos(productos), { total: 6, activos: 4, inactivos: 2 });
  });
});

describe("categoriasDeProductos", () => {
  it("returns unique trimmed categories sorted, skipping empty ones", () => {
    assert.deepEqual(categoriasDeProductos(productos), ["Acompañamientos", "Bebidas", "Hamburguesas"]);
  });
});

describe("filtrarProductos", () => {
  const nombres = (lista: { nombre: string }[]) => lista.map((p) => p.nombre);

  it("returns everything with empty filters", () => {
    assert.equal(filtrarProductos(productos, { texto: "", categoria: null, estado: "todos" }).length, 6);
  });

  it("searches by name ignoring case and accents", () => {
    const r = filtrarProductos(productos, { texto: "smash", categoria: null, estado: "todos" });
    assert.deepEqual(nombres(r), ["Smash Doble", "Smash Simple"]);
    const r2 = filtrarProductos(productos, { texto: "acompanamientos", categoria: null, estado: "todos" });
    assert.deepEqual(nombres(r2), ["Papas Fritas"]);
  });

  it("filters by trimmed category", () => {
    const r = filtrarProductos(productos, { texto: "", categoria: "Bebidas", estado: "todos" });
    assert.deepEqual(nombres(r), ["Coca Cola"]);
  });

  it("filters by status", () => {
    const activos = filtrarProductos(productos, { texto: "", categoria: null, estado: "activos" });
    assert.deepEqual(nombres(activos), ["Smash Doble", "Papas Fritas", "Agua", "Combo Sorpresa"]);
    const inactivos = filtrarProductos(productos, { texto: "", categoria: "Hamburguesas", estado: "inactivos" });
    assert.deepEqual(nombres(inactivos), ["Smash Simple"]);
  });
});
