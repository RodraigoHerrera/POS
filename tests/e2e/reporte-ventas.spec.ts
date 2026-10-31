import { test, expect } from "@playwright/test";
import { loginSucursal, seleccionarEmpleadoYPin } from "./helpers";

const SUCURSAL_CORREO = "demo@smash.com";
const SUCURSAL_PASSWORD = "DemoTesis2026!";
const ADMIN_USUARIO = "admin_demo";
const PIN = "1234";

test.describe("Módulo de Reporte de Ventas", () => {
  test.beforeEach(async ({ page }) => {
    await test.step("Login como administrador", async () => {
      await loginSucursal(page, SUCURSAL_CORREO, SUCURSAL_PASSWORD);
      await seleccionarEmpleadoYPin(page, ADMIN_USUARIO, PIN);
      await expect(page).toHaveURL(/\/admin(\/|$)/);
    });
  });

  test("navegación entre tipos de reporte, presets de fecha y descarga de CSV", async ({ page }) => {
    await test.step("Acceder a la página de reporte de ventas", async () => {
      const datosCargados = page.waitForResponse(
        (r) => r.url().includes("/api/admin/reportes/ventas") && r.request().method() === "GET",
        { timeout: 30_000 }
      );
      await page.goto("/admin/reporte-ventas");
      await expect(page.getByRole("heading", { name: "Reporte de ventas" })).toBeVisible();
      await datosCargados;
    });

    await test.step("Alternar entre pestañas de reportes", async () => {
      // 1. Reporte por Cajas
      const respCajas = page.waitForResponse(
        (r) => r.url().includes("tipo=caja") && r.request().method() === "GET"
      );
      await page.getByRole("tab", { name: "Cajas" }).click();
      await respCajas;
      await expect(page.getByText("Una fila por caja abierta")).toBeVisible();

      // 2. Reporte por Producto
      const respProducto = page.waitForResponse(
        (r) => r.url().includes("tipo=producto-resumen") && r.request().method() === "GET"
      );
      await page.getByRole("tab", { name: "Por producto" }).click();
      await respProducto;
      await expect(page.getByText("Totales por producto")).toBeVisible();

      // 3. Reporte de Ventas Anuladas
      const respAnuladas = page.waitForResponse(
        (r) => r.url().includes("tipo=anuladas") && r.request().method() === "GET"
      );
      await page.getByRole("tab", { name: "Anuladas" }).click();
      await respAnuladas;
      await expect(page.getByText("Pedidos anulados")).toBeVisible();

      // Regresar a Por Usuario
      const respUsuario = page.waitForResponse(
        (r) => r.url().includes("tipo=usuario") && r.request().method() === "GET"
      );
      await page.getByRole("tab", { name: "Por usuario" }).click();
      await respUsuario;
    });

    await test.step("Filtrar usando presets de fecha", async () => {
      const respPreset = page.waitForResponse(
        (r) => r.url().includes("/api/admin/reportes/ventas") && r.request().method() === "GET"
      );
      await page.getByRole("button", { name: "7 días" }).click();
      await respPreset;
    });

    await test.step("Descargar reporte CSV y validar feedback Sonner", async () => {
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "Descargar CSV" }).click(),
      ]);

      expect(download.suggestedFilename()).toMatch(/^reporte_.*\.csv$/);
      await expect(page.getByText("Reporte descargado.")).toBeVisible();
    });
  });
});
