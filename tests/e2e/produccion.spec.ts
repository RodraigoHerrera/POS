import { test, expect } from "@playwright/test";
import { loginSucursal, seleccionarEmpleadoYPin } from "./helpers";

const SUCURSAL_CORREO = "demo@smash.com";
const SUCURSAL_PASSWORD = "DemoTesis2026!";
const ADMIN_USUARIO = "admin_demo";
const PIN = "1234";

test.describe("Flujo de Producción", () => {
  test.beforeEach(async ({ page }) => {
    await test.step("Login como administrador", async () => {
      await loginSucursal(page, SUCURSAL_CORREO, SUCURSAL_PASSWORD);
      await seleccionarEmpleadoYPin(page, ADMIN_USUARIO, PIN);
      await expect(page).toHaveURL(/\/admin(\/|$)/);
    });
  });

  test("debería permitir registrar una producción exitosamente", async ({ page }) => {
    await test.step("Navegar a Producción y ejecutar lote", async () => {
      await page.goto("/admin/produccion");
      await expect(page.getByRole("heading", { name: "Registro de Producción" })).toBeVisible();

      // Seleccionar la primera receta disponible (index 1 porque 0 es el placeholder)
      await page.locator("select").nth(1).selectOption({ index: 1 });

      // Ingresar una cantidad razonable (pequeña para asegurar que haya stock)
      await page.locator('input[type="number"]').fill("1");

      // Ejecutar la acción
      await page.getByRole("button", { name: "Ejecutar Producción" }).click();

      // Esperar mensaje de éxito
      await expect(page.getByText("Lote de producción generado con éxito.")).toBeVisible({ timeout: 15_000 });
    });
  });

  test("debería mostrar error si los insumos son insuficientes", async ({ page }) => {
    await test.step("Navegar a Producción y ejecutar lote gigante", async () => {
      await page.goto("/admin/produccion");
      await expect(page.getByRole("heading", { name: "Registro de Producción" })).toBeVisible();

      // Seleccionar la primera receta disponible
      await page.locator("select").nth(1).selectOption({ index: 1 });

      // Ingresar una cantidad gigantesca para forzar el error FEFO
      await page.locator('input[type="number"]').fill("99999");

      // Ejecutar la acción
      await page.getByRole("button", { name: "Ejecutar Producción" }).click();

      // Esperar mensaje de error de insuficiencia de stock
      await expect(page.getByText(/Insumo insuficiente/)).toBeVisible({ timeout: 15_000 });
    });
  });
});
