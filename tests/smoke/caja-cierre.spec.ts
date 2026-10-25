import { test, expect } from "@playwright/test";
import { loginSucursal, seleccionarEmpleadoYPin, abrirCaja, cerrarCaja } from "../e2e/helpers";
import { SMOKE } from "./smokeEnv";

const APERTURA = 100;
const CONTADO = APERTURA + SMOKE.precio;
const bs = (monto: number) => `Bs ${monto.toFixed(2)}`;

test("caja: abrir -> vender -> cerrar -> ticket de cierre imprimible", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  // window.print real abriría el diálogo del navegador: se reemplaza por un contador.
  await page.addInitScript(() => {
    (window as unknown as { __printCalls: number }).__printCalls = 0;
    window.print = () => {
      (window as unknown as { __printCalls: number }).__printCalls += 1;
    };
  });

  await loginSucursal(page, SMOKE.sucursalCorreo, SMOKE.sucursalPassword);
  await seleccionarEmpleadoYPin(page, SMOKE.cajero, SMOKE.pin);
  await abrirCaja(page, APERTURA);

  await page.locator('input[placeholder="Buscar producto..."]').fill(SMOKE.producto);
  await page.getByRole("button", { name: new RegExp(`Agregar ${SMOKE.producto}`) }).click();
  await expect(page.locator(`button[aria-label="Quitar ${SMOKE.producto} del pedido"]`)).toBeVisible();
  await page.getByRole("button", { name: "Comandar" }).click();
  await page.waitForURL(/\/cajero\/metodos-pago/);
  await page.locator('input[type="number"]').fill(String(SMOKE.precio));
  await page.getByRole("button", { name: "Confirmar Cobro" }).click();
  await page.waitForURL(/\/cajero\/ventas/);

  await cerrarCaja(page, CONTADO);

  // Ticket en pantalla
  const imprimir = page.getByRole("button", { name: "Imprimir" });
  const salir = page.getByRole("button", { name: "Salir" });
  await expect(page.getByRole("heading", { name: "SMASH POS" })).toBeVisible(); // espera al ticket
  await expect(page.getByText("Cierre de Caja", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Apertura:/)).toBeVisible();
  await expect(page.getByText(/^Cierre:/)).toBeVisible();
  await expect(page.getByText("Ventas por método")).toBeVisible();
  for (const metodo of ["Efectivo", "Tarjeta", "QR", "Transferencia", "Gift Card", "Otros"]) {
    await expect(page.getByText(metodo, { exact: true })).toBeVisible();
  }
  const fila = (etiqueta: string) => page.getByText(etiqueta, { exact: true }).locator("xpath=..");
  await expect(fila("Caja abierta con")).toContainText(bs(APERTURA));
  await expect(fila("Efectivo esperado")).toContainText(bs(CONTADO));
  await expect(fila("Caja cerrada con")).toContainText(bs(CONTADO));
  await expect(fila("Total ventas")).toContainText(bs(SMOKE.precio));
  await expect(fila("Exacta")).toContainText(bs(0));
  await expect(imprimir).toBeVisible();
  await expect(salir).toBeVisible();

  // Imprimir dispara window.print (stub)
  await imprimir.click();
  expect(await page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls)).toBe(1);

  // Vista de impresión: solo el ticket, sin botones
  await page.emulateMedia({ media: "print" });
  await expect(imprimir).toBeHidden();
  await expect(salir).toBeHidden();
  await expect(page.getByText("Cierre de Caja", { exact: true })).toBeVisible();
  await expect(page.getByText("-- Fin de Cierre --")).toBeVisible();
  await expect(fila("Exacta")).toBeVisible();
  await page.emulateMedia({ media: "screen" });

  await salir.click();
  await expect(page).toHaveURL(/\/usuarios(\/)?$/);
});
