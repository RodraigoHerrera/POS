import { test, expect } from "@playwright/test";
import { loginSucursal, seleccionarEmpleadoYPin, selectByLabel, fillByLabel } from "./helpers";

const SUCURSAL_CORREO = "demo@smash.com";
const SUCURSAL_PASSWORD = "DemoTesis2026!";
const ADMIN_USUARIO = "admin_demo";
const PIN = "1234";

test.describe("Kardex de Inventario y Movimientos", () => {
  // Serial: el registro de entrada deja el movimiento que el test de exportación necesita.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await test.step("Login como administrador", async () => {
      await loginSucursal(page, SUCURSAL_CORREO, SUCURSAL_PASSWORD);
      await seleccionarEmpleadoYPin(page, ADMIN_USUARIO, PIN);
      await expect(page).toHaveURL(/\/admin(\/|$)/);
    });
  });

  test("registro de entrada con generación automática de lote y trazabilidad en Kardex", async ({ page }) => {
    await page.goto("/admin/inventario");

    // Abrir modal de Entrada
    const itemsCargados = page.waitForResponse(
      (r) => r.url().includes("/api/inventarios/items") && r.request().method() === "GET",
      { timeout: 30_000 }
    );
    await page.getByRole("button", { name: /^Entrada$/i }).click();
    await expect(page.getByText("Registrar entrada de items")).toBeVisible();
    await itemsCargados;

    // Llenar formulario omitiendo el lote para validar generación automática
    await selectByLabel(page, "Item", "Pan Demo");
    await selectByLabel(page, "Motivo", "Compra");
    await fillByLabel(page, "Cantidad", "10");
    // El costo arranca en modo "Costo total": alternar a unitario antes de llenar.
    await page.getByRole("group", { name: "Tipo de costo" }).getByRole("button", { name: "Costo unitario" }).click();
    await page.getByPlaceholder("Ingrese el costo").fill("1.50");
    const refUnica = `E2E-AUTO-${Date.now()}`;
    await fillByLabel(page, "Referencia", refUnica);

    const entradaResp = page.waitForResponse(
      (r) => r.url().includes("/api/inventarios/registrarEntrada") && r.request().method() === "POST",
      { timeout: 20_000 }
    );
    await page.getByRole("button", { name: /^Registrar Entrada$/ }).click();
    const res = await entradaResp;
    expect(res.status()).toBe(201);
    await expect(page.getByText("Operación exitosa")).toBeVisible();

    // Reabrir Kardex y comprobar que el movimiento fue indexado con la referencia
    const kardexCargado = page.waitForResponse(
      (r) => r.url().includes("/api/inventarios/kardex") && r.request().method() === "GET",
      { timeout: 30_000 }
    );
    await page.getByRole("button", { name: "Kardex", exact: true }).click();
    await kardexCargado;

    // La referencia debe ser visible en la columna Detalle del Kardex
    await expect(page.getByText(refUnica)).toBeVisible({ timeout: 15_000 });
  });

  test("visualización, columnas del Kardex, filtros y exportación CSV con feedback", async ({ page }) => {
    await page.goto("/admin/inventario");

    // Abrir modal Kardex
    const kardexCargado = page.waitForResponse(
      (r) => r.url().includes("/api/inventarios/kardex") && r.request().method() === "GET",
      { timeout: 30_000 }
    );
    await page.getByRole("button", { name: "Kardex", exact: true }).click();
    await expect(page.getByText("Kardex de Inventario")).toBeVisible();
    await kardexCargado;

    // Verificar presencia de columnas estructurales
    const columnasEsperadas = [
      "Fecha",
      "Item",
      "Detalle",
      "Lote",
      "Registrado por",
      "Cantidad",
      "Costo Unit.",
      "Total",
      "Acciones",
    ];
    for (const col of columnasEsperadas) {
      await expect(page.locator("th", { hasText: col })).toBeVisible();
    }

    // Exportar Kardex a CSV (requiere al menos un movimiento: lo deja el test anterior): verificar toast y evento de descarga
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Exportar", exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^kardex_.*\.csv$/);
    await expect(page.getByText(/Kardex exportado:/)).toBeVisible();

    // Cerrar modal
    await page.keyboard.press("Escape");
    await expect(page.getByText("Kardex de Inventario")).toBeHidden();
  });
});
