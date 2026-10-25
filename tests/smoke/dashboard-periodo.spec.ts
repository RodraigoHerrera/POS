import { test, expect } from "@playwright/test";
import { loginSucursal, seleccionarEmpleadoYPin } from "../e2e/helpers";
import { SMOKE } from "./smokeEnv";

test("dashboard admin: el toggle Mes/Semana cambia etiquetas y vuelve a consultar", async ({ page }) => {
  await loginSucursal(page, SMOKE.sucursalCorreo, SMOKE.sucursalPassword);
  await seleccionarEmpleadoYPin(page, SMOKE.admin, SMOKE.pin);
  await expect(page).toHaveURL(/\/admin(\/|$)/);

  const mes = page.getByRole("button", { name: "Mes", exact: true });
  const semana = page.getByRole("button", { name: "Semana", exact: true });
  await expect(page.getByText("Ventas (Mes Actual)")).toBeVisible();
  await expect(mes).toHaveAttribute("aria-pressed", "true");

  const requestSemana = page.waitForRequest((r) => r.url().includes("/api/ventas/ventaMensual?periodo=semana"));
  await semana.click();
  await requestSemana;
  await expect(page.getByText("Ventas (Semana Actual)")).toBeVisible();
  await expect(semana).toHaveAttribute("aria-pressed", "true");

  const requestMes = page.waitForRequest((r) => r.url().includes("/api/ventas/ventaMensual?periodo=mes"));
  await mes.click();
  await requestMes;
  await expect(page.getByText("Ventas (Mes Actual)")).toBeVisible();
});
