import { test, expect } from "@playwright/test";
import { loginSucursal, seleccionarEmpleadoYPin } from "./helpers";
import { SMOKE } from "../smoke/smokeEnv";

// La sucursal smoke (seed de tests/smoke) es la única con una preparación con
// receta y stock de insumos: "Salsa Smoke" (Tomate 0.8 kg + Aceite 0.1 L por L).
const PREPARACION = "Salsa Smoke";

test.describe("Flujo de Producción", () => {
  test.beforeEach(async ({ page }) => {
    await test.step("Login como administrador", async () => {
      await loginSucursal(page, SMOKE.sucursalCorreo, SMOKE.sucursalPassword);
      await seleccionarEmpleadoYPin(page, SMOKE.admin, SMOKE.pin);
      await expect(page).toHaveURL(/\/admin(\/|$)/);
    });
  });

  test("debería permitir registrar una producción exitosamente", async ({ page }) => {
    await test.step("Navegar a Producción y ejecutar lote", async () => {
      await page.goto("/admin/produccion");
      await expect(page.getByRole("heading", { name: "Registro de Producción" })).toBeVisible();

      await page.getByRole("combobox").selectOption({ label: PREPARACION });
      await page.locator("#cantidad").fill("1");

      await page.getByRole("button", { name: "Ejecutar producción" }).click();

      await expect(page.getByText(/Lote de producción generado con éxito/)).toBeVisible({ timeout: 15_000 });
    });
  });

  test("debería bloquear la producción si los insumos son insuficientes", async ({ page }) => {
    await test.step("Navegar a Producción y pedir un lote gigante", async () => {
      await page.goto("/admin/produccion");
      await expect(page.getByRole("heading", { name: "Registro de Producción" })).toBeVisible();

      await page.getByRole("combobox").selectOption({ label: PREPARACION });
      await page.locator("#cantidad").fill("99999");

      // La validación FEFO es previa: el botón se deshabilita y se listan los faltantes.
      await expect(page.getByText(/Faltan \d+ insumo\(s\) para esta cantidad/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Ejecutar producción" })).toBeDisabled();
    });
  });
});
