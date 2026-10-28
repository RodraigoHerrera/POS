import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loginSucursal, seleccionarEmpleadoYPin, abrirCaja, cerrarCaja } from "../e2e/helpers";
import { SMOKE, resolveSmokeDatabaseUrl } from "./smokeEnv";

const APERTURA = 100;
const CONTADO = APERTURA + SMOKE.precio;
// Totales electrónicos declarados: la venta del smoke es en efectivo, así que
// lo esperado por Tarjeta/QR es 0. Tarjeta declara 10 (sobrante), QR declara 0.
const TARJETA_DECLARADA = 10;
const QR_DECLARADO = 0;
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

  await cerrarCaja(page, CONTADO, { tarjeta: TARJETA_DECLARADA, qr: QR_DECLARADO });

  // Ticket en pantalla
  const imprimir = page.getByRole("button", { name: "Imprimir" });
  const salir = page.getByRole("button", { name: "Salir" });
  await expect(page.getByRole("heading", { name: "SMASH POS" })).toBeVisible(); // espera al ticket
  await expect(page.getByText("Cierre de Caja", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Apertura:/)).toBeVisible();
  await expect(page.getByText(/^Cierre:/)).toBeVisible();
  await expect(page.getByText("Ventas por método")).toBeVisible();
  const ventasPorMetodo = page.getByText("Ventas por método").locator("xpath=..");
  for (const metodo of ["Efectivo", "Tarjeta", "QR", "Transferencia", "Gift Card", "Otros"]) {
    await expect(ventasPorMetodo.getByText(metodo, { exact: true })).toBeVisible();
  }
  const fila = (etiqueta: string) => page.getByText(etiqueta, { exact: true }).locator("xpath=..");
  await expect(fila("Caja abierta con")).toContainText(bs(APERTURA));
  await expect(fila("Total ventas")).toContainText(bs(SMOKE.precio));
  // El efectivo esperado/contado solo aparece en la conciliación.
  await expect(page.getByText("Efectivo esperado")).toHaveCount(0);
  await expect(page.getByText("Caja cerrada con")).toHaveCount(0);

  // Conciliación por método: Esperado (Sistema) / Declarado (Manual) / Diferencia
  await expect(page.getByText("Conciliación", { exact: true })).toBeVisible();
  const conciliacion = (metodo: string) => page.getByTestId(`conciliacion-${metodo}`);
  await expect(conciliacion("Efectivo")).toContainText(bs(CONTADO));
  await expect(conciliacion("Efectivo")).toContainText("Diferencia: Exacta");
  await expect(conciliacion("Tarjeta")).toContainText(`Esperado (Sistema)${bs(0)}`);
  await expect(conciliacion("Tarjeta")).toContainText(`Declarado (Manual)${bs(TARJETA_DECLARADA)}`);
  await expect(conciliacion("Tarjeta")).toContainText(`Diferencia: Sobrante${bs(TARJETA_DECLARADA)}`);
  await expect(conciliacion("QR")).toContainText(`Declarado (Manual)${bs(QR_DECLARADO)}`);
  await expect(conciliacion("QR")).toContainText("Diferencia: Exacta");
  await expect(imprimir).toBeVisible();
  await expect(salir).toBeVisible();

  // Persistencia de la conciliación: sistema, declarado y diferencia por método
  const prisma = new PrismaClient({ datasourceUrl: resolveSmokeDatabaseUrl() });
  try {
    const caja = await prisma.caja.findFirstOrThrow({
      where: { estado: "cerrada", empleado: { usuario: SMOKE.cajero } },
      orderBy: { fecha_cierre: "desc" },
    });
    expect(Number(caja.saldo_final)).toBe(CONTADO);
    expect(Number(caja.diferencia_efectivo)).toBe(0);
    expect(Number(caja.ventas_tarjeta)).toBe(0);
    expect(Number(caja.declarado_tarjeta)).toBe(TARJETA_DECLARADA);
    expect(Number(caja.diferencia_tarjeta)).toBe(TARJETA_DECLARADA);
    expect(Number(caja.ventas_qr)).toBe(0);
    expect(caja.declarado_qr).not.toBeNull();
    expect(Number(caja.declarado_qr)).toBe(QR_DECLARADO);
    expect(Number(caja.diferencia_qr)).toBe(0);
  } finally {
    await prisma.$disconnect();
  }

  // Imprimir dispara window.print (stub)
  await imprimir.click();
  expect(await page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls)).toBe(1);

  // Vista de impresión: solo el ticket, sin botones
  await page.emulateMedia({ media: "print" });
  await expect(imprimir).toBeHidden();
  await expect(salir).toBeHidden();
  await expect(page.getByText("Cierre de Caja", { exact: true })).toBeVisible();
  await expect(page.getByText("-- Fin de Cierre --")).toBeVisible();
  await expect(page.getByTestId("conciliacion-Efectivo")).toBeVisible();
  await page.emulateMedia({ media: "screen" });

  await salir.click();
  await expect(page).toHaveURL(/\/usuarios(\/)?$/);
});
