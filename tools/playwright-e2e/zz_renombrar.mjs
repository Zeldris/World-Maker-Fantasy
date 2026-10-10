import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:5173/');
await page.waitForTimeout(1500);
await page.getByText('En solitario', { exact: false }).first().click();
await page.waitForTimeout(1500);
await page.getByText('Helek Sirik').first().click();
await page.waitForTimeout(500);
await page.getByText('Continuar', { exact: false }).click();
await page.waitForTimeout(1500);
await page.getByText('Gorhorn', { exact: true }).first().click();
await page.waitForTimeout(500);
await page.getByText('Continuar', { exact: false }).click();
await page.waitForTimeout(2000);

// Fila de la partida de prueba: la que NO contiene "Partida real"
const fila = page.locator('div.plank-panel').filter({ hasNotText: 'Partida real' }).first();
const btn = fila.getByRole('button', { name: 'Renombrar partida' });
await btn.click();
await page.waitForTimeout(600);
const input = page.getByPlaceholder('Nombre para diferenciarla...');
const visible = await input.count();
console.log('Input visible tras clic en la fila correcta:', visible);
if (visible > 0) {
  await input.fill('TEST Claude - no tocar');
  await input.press('Enter');
  await page.waitForTimeout(800);
}
await page.screenshot({ path: 'screenshots/13_renombrado_final.png', fullPage: true });
console.log('URL:', page.url());
await browser.close();
