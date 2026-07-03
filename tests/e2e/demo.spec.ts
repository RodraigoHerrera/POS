import { test, expect } from "@playwright/test";
import {
  loginSucursal,
  seleccionarEmpleadoYPin,
  abrirCaja,
  cerrarCaja,
  selectByLabel,
  fillByLabel,
} from "./helpers";

/**
 * Guion narrado para la defensa de tesis: recorre el sistema real por UI
 * (sin atajos de API) para que se vea reaccionar en vivo. Requiere haber
 * corrido `npm run db:seed:demo` antes (sucursal/empleados/producto/60 días
 * de historial ya sembrados).
 */
const SUCURSAL_CORREO = "demo@smash.com";
const SUCURSAL_PASSWORD = "DemoTesis2026!";
const CAJERO_USUARIO = "cajero_demo";
const ADMIN_USUARIO = "admin_demo";
const PIN = "1234";

const PRODUCTO = "Hamburguesa Demo";
const PRECIO = 50;
const APERTURA_MONTO = 100;

test("Smash POS — recorrido completo de demo para la defensa", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());

  await test.step("Login como cajero (sucursal -> empleado -> PIN)", async () => {
    await loginSucursal(page, SUCURSAL_CORREO, SUCURSAL_PASSWORD);
    await seleccionarEmpleadoYPin(page, CAJERO_USUARIO, PIN);
    await expect(page).toHaveURL(/\/cajero(\/|$)/);
  });

  await test.step("Abrir caja con Bs 100 de fondo", async () => {
    await abrirCaja(page, APERTURA_MONTO);
    await expect(page).toHaveURL(/\/cajero\/ventas/);
  });

  for (let pedidoNum = 1; pedidoNum <= 2; pedidoNum++) {
    await test.step(`Vender 1x "${PRODUCTO}" y cobrar en efectivo (pedido ${pedidoNum})`, async () => {
      await page.locator('input[placeholder="Buscar producto..."]').fill(PRODUCTO);
      await page.getByRole("button", { name: new RegExp(`Agregar ${PRODUCTO}`) }).click();
      // El botón "Quitar ... del pedido" solo existe en la línea del carrito,
      // a diferencia del nombre del producto que también aparece en la tarjeta del catálogo.
      await expect(page.locator(`button[aria-label="Quitar ${PRODUCTO} del pedido"]`)).toBeVisible();

      await page.getByRole("button", { name: "Comandar" }).click();
      await page.waitForURL(/\/cajero\/metodos-pago/);

      await page.locator('input[type="number"]').fill(String(PRECIO));
      await page.getByRole("button", { name: "Confirmar Cobro" }).click();
      await page.waitForURL(/\/cajero\/ventas/);
    });
  }

  await test.step("Cerrar caja y verificar arqueo exacto", async () => {
    const totalEsperado = APERTURA_MONTO + 2 * PRECIO; // 100 fondo + 2 ventas de Bs 50 en efectivo
    await cerrarCaja(page, totalEsperado);
    await expect(page.getByText("Caja cerrada")).toBeVisible();
    await expect(page.getByText("Caja exacta")).toBeVisible();
    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page).toHaveURL(/\/usuarios(\/)?$/);
  });

  await test.step("Cambiar a Administrador", async () => {
    await seleccionarEmpleadoYPin(page, ADMIN_USUARIO, PIN);
    await expect(page).toHaveURL(/\/admin(\/|$)/);
  });

  await test.step("Dashboard: las métricas reaccionan a las ventas (histórico + en vivo)", async () => {
    await expect(page.getByText("Ventas (Mes Actual)")).toBeVisible();
    await expect(page.getByText("Pedidos (Mes Actual)")).toBeVisible();
    await expect(page.locator("h4", { hasText: "Bs" }).first()).toBeVisible({ timeout: 15_000 });
  });

  await test.step("MRP: pronóstico de demanda + explosión de materiales + OC sugeridas", async () => {
    await page.goto("/admin/mrp");
    await page.getByRole("button", { name: "Ejecutar MRP" }).click();

    await expect(page.getByText(/Pronóstico y MPS/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("cell", { name: PRODUCTO })).toBeVisible();

    await expect(page.getByText("Necesidades de insumos")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Carne Demo" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Pan Demo" })).toBeVisible();

    // Carne Demo tiene proveedor asignado en el seed -> se genera una OC Borrador automática.
    await expect(page.getByText("Órdenes de compra (Borrador)")).toBeVisible();
    await expect(page.getByText(/OC #\d+ · Proveedor Demo SRL/)).toBeVisible();

    // Pan Demo no tiene proveedor -> el sistema debe advertirlo en vez de generar la OC a ciegas.
    await expect(page.getByText(/[Ss]in proveedor/).first()).toBeVisible();
  });

  await test.step("Menú: editar el producto en vivo", async () => {
    await page.goto("/admin/menu");
    const card = page
      .locator("h4", { hasText: PRODUCTO })
      .locator("xpath=ancestor::div[contains(@class,'rounded-[20px]')][1]");
    await card.getByRole("button", { name: "Editar Producto" }).click();

    await expect(page.getByText("Editar Información")).toBeVisible();
    // Se edita la descripción (no el precio) para no descalibrar el monto
    // cobrado en el paso de ventas si el test se corre de nuevo sin re-sembrar.
    await page.locator("#descripcion").fill("Promo defensa de tesis");

    const guardarResp = page.waitForResponse(
      (r) => r.url().includes("/api/inventarios/productos/editar") && r.request().method() === "PUT"
    );
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    expect((await guardarResp).status()).toBe(200);
  });

  await test.step("Recetas: redefinir el BOM en vivo (Carne Demo + Pan Demo)", async () => {
    await page.goto("/admin/recetas");
    const card = page
      .locator("h4", { hasText: PRODUCTO })
      .locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
    await card.getByRole("button", { name: "Editar Receta" }).click();

    await expect(page.getByText(`Receta de: ${PRODUCTO}`)).toBeVisible();
    // El modal de edición no precarga los insumos existentes (siempre arranca
    // en "No hay insumos agregados aún") y la API reemplaza el BOM completo
    // con lo que se envíe -> hay que reconstruir las 2 filas (Carne + Pan),
    // no solo añadir una, o se perdería el insumo no tocado.
    const numeroInputs = page.locator('input[type="number"][placeholder="0.00"]');

    await page.getByRole("button", { name: "+ Añadir Insumo" }).click();
    await page.locator("select").nth(0).selectOption({ label: "Carne Demo (kg)" });
    await numeroInputs.nth(0).fill("0.18"); // se sube de 0.15 a 0.18 kg/unidad, en vivo

    await page.getByRole("button", { name: "+ Añadir Insumo" }).click();
    await page.locator("select").nth(1).selectOption({ label: "Pan Demo (u)" });
    await numeroInputs.nth(1).fill("1");

    const guardarResp = page.waitForResponse(
      (r) => r.url().includes("/api/inventarios/modificarReceta") && r.request().method() === "PUT"
    );
    await page.getByRole("button", { name: "Guardar Cambios" }).click();
    expect((await guardarResp).status()).toBe(200);
  });

  await test.step("Inventario: registrar una entrada de stock en vivo (repone Pan Demo)", async () => {
    await page.goto("/admin/inventario");
    // El dropdown "Item" se llena vía fetch async al abrir el modal; si la
    // ruta tarda (primera visita = compila en frío), selectOption falla
    // porque la opción todavía no existe. Se arma la espera antes del click
    // para no perder la respuesta por una carrera.
    const itemsCargados = page.waitForResponse(
      (r) => r.url().includes("/api/inventarios/items") && r.request().method() === "GET",
      { timeout: 30_000 }
    );
    await page.getByRole("button", { name: "Registrar entrada" }).click();
    await expect(page.getByText("Registrar entrada de items")).toBeVisible();
    await itemsCargados;

    await selectByLabel(page, "Item", "Pan Demo");
    await selectByLabel(page, "Motivo", "Compra");
    await fillByLabel(page, "Lote", `DEMO-ENTRADA-${Date.now()}`);
    await fillByLabel(page, "Cantidad", "20");
    await fillByLabel(page, "Costo unitario", "1.20");
    await fillByLabel(page, "Referencia", "FACT-DEMO-INVENTARIO");
    // Proveedor se deja sin seleccionar: si se asigna aquí, el item queda con
    // proveedor permanente y el MRP deja de mostrar la advertencia "sin
    // proveedor" para Pan Demo en la próxima corrida del test.

    const entradaResp = page.waitForResponse(
      (r) => r.url().includes("/api/inventarios/registrarEntrada") && r.request().method() === "POST",
      { timeout: 20_000 } // primera visita a esta ruta puede compilar en frío
    );
    // El botón de la página dice "Registrar entrada" (minúscula) y el del
    // modal "Registrar Entrada" (mayúscula); getByRole es case-insensitive,
    // así que se necesita una regex exacta (sin /i) para no chocar con el de la página.
    await page.getByRole("button", { name: /^Registrar Entrada$/ }).click();
    expect((await entradaResp).status()).toBe(201);
  });

  await test.step("Usuarios: agregar un nuevo empleado en vivo", async () => {
    await page.goto("/admin/usuarios");
    await page.getByRole("button", { name: "Agregar Usuario" }).click();

    await expect(page.getByText("Editar Información Personal")).toBeVisible();
    await page.getByPlaceholder("Juan Pérez").fill("Mesero Demo");
    await page.getByPlaceholder("juanperez").fill("mesero_demo");
    await page.getByPlaceholder("ejemplo").fill("mesero_demo");
    await page.getByPlaceholder("6XXXXXX").fill("70000001");
    await page.locator('input[type="password"]').nth(0).fill("MeseroDemo123!");
    await page.locator('input[type="password"]').nth(1).fill("MeseroDemo123!");
    // El switch de "Privilegios de Administrador" se deja apagado -> rol Cajero.

    const registroResp = page.waitForResponse(
      (r) => r.url().includes("/api/auth/registerAdmin") && r.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Registrar Usuario" }).click();
    expect((await registroResp).status()).toBe(201);

    await expect(page.getByText("Mesero Demo")).toBeVisible();
  });
});
