import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
page.on('console', msg => { if (msg.type() === 'error') console.log('[console error]', msg.text()); });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByText('En solitario', { exact: true }).click();
await page.waitForTimeout(1500);
await page.getByText('Helek Sirik', { exact: true }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /continuar/i }).click();
await page.waitForTimeout(1500);

// Paso 2: intenta pulsar Continuar directamente, sin volver a clicar la tarjeta (ya viene preseleccionada).
const continuarBtn2 = page.getByRole('button', { name: /continuar/i });
const disabledAntes = await continuarBtn2.isDisabled();
console.log('¿Continuar deshabilitado con Gorhorn ya preseleccionado?', disabledAntes);

if (disabledAntes) {
  await page.getByText('Gorhorn', { exact: true }).click();
  await page.waitForTimeout(500);
  console.log('¿Sigue deshabilitado tras clicar la tarjeta?', await continuarBtn2.isDisabled());
}
await continuarBtn2.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/sesion02_04_paso3.png', fullPage: true });
console.log(await page.locator('body').innerText());
await browser.close();
console.log('OK');
