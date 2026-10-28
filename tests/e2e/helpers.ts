import type { Page } from "@playwright/test";

const BILLETES = [200, 100, 50, 20, 10];
const MONEDAS = [5, 2, 1, 0.5, 0.2, 0.1];

function labelFor(denom: number, tipo: "Billete" | "Moneda") {
  return tipo === "Billete" ? `Bs. ${denom}` : `Bs. ${denom.toFixed(2)}`;
}

async function fillDenominacion(page: Page, label: string, cantidad: number) {
  // Cada input de cantidad tiene aria-label "Cantidad Bs. 200" (exact evita
  // que "Bs. 10" matchee "Bs. 100"; los steppers usan otros labels).
  await page.getByLabel(`Cantidad ${label}`, { exact: true }).fill(String(cantidad));
}

/** Llena la grilla de denominaciones para alcanzar exactamente `montoTotal` y envía el formulario. */
async function contarEfectivo(page: Page, montoTotal: number, submitText: string) {
  let restanteCentavos = Math.round(montoTotal * 100);

  for (const denom of BILLETES) {
    const denomCentavos = denom * 100;
    const cantidad = Math.floor(restanteCentavos / denomCentavos);
    if (cantidad > 0) {
      await fillDenominacion(page, labelFor(denom, "Billete"), cantidad);
      restanteCentavos -= cantidad * denomCentavos;
    }
  }
  for (const denom of MONEDAS) {
    const denomCentavos = Math.round(denom * 100);
    const cantidad = Math.floor(restanteCentavos / denomCentavos);
    if (cantidad > 0) {
      await fillDenominacion(page, labelFor(denom, "Moneda"), cantidad);
      restanteCentavos -= cantidad * denomCentavos;
    }
  }

  if (restanteCentavos !== 0) {
    throw new Error(
      `No se pudo representar Bs ${montoTotal} exactamente con las denominaciones disponibles (resto ${restanteCentavos} centavos)`
    );
  }

  await page.getByRole("button", { name: submitText }).click();
}

/** Ubica el campo (select/input) que es hermano directo de un <Label> con texto exacto. */
function fieldByLabel(page: Page, labelText: string) {
  const label = page.getByText(labelText, { exact: true });
  return label.locator("xpath=ancestor::div[1]");
}

/** Para los <select> nativos de @/components/form/Select (Item, Motivo, Proveedor, etc). */
export async function selectByLabel(page: Page, labelText: string, optionLabel: string) {
  await fieldByLabel(page, labelText).locator("select").selectOption({ label: optionLabel });
}

/** Para los <Input> de @/components/form/input/InputField identificados por su <Label> hermano. */
export async function fillByLabel(page: Page, labelText: string, value: string) {
  await fieldByLabel(page, labelText).locator("input").fill(value);
}

export async function loginSucursal(page: Page, correo: string, password: string) {
  await page.goto("/");
  await page.locator('input[type="email"]').fill(correo);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Iniciar Sesión" }).click({ force: true });
  await page.waitForURL("**/usuarios");
}

export async function seleccionarEmpleadoYPin(page: Page, usuario: string, pin: string) {
  await page.getByText(usuario).first().click();
  await page.waitForURL(/\/usuarios\/pin\?id=/);
  await page.locator('input[type="password"]').fill(pin);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/(admin|cajero)(\/|$)/);
}

/** Asume que la página ya está en /cajero (landing tras el login del Cajero). */
export async function abrirCaja(page: Page, montoTotal: number) {
  await contarEfectivo(page, montoTotal, "Confirmar Apertura");
  await page.waitForURL("**/cajero/ventas");
}

export async function cerrarCaja(
  page: Page,
  montoTotal: number,
  electronicos: { tarjeta: number; qr: number } = { tarjeta: 0, qr: 0 }
) {
  await page.goto("/cajero/cierre");
  await page.locator("#total-tarjeta").fill(String(electronicos.tarjeta));
  await page.locator("#total-qr").fill(String(electronicos.qr));
  await contarEfectivo(page, montoTotal, "Confirmar Cierre");
}
