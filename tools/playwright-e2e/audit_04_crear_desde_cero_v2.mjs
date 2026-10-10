import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(8000);

try {
  await page.goto('http://localhost:5173/solitario');
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /Helek Sirik/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Continuar →' }).click();
  await page.waitForTimeout(1000);
  console.log('Antes de crear desde cero, URL:', page.url());
  await page.getByRole('button', { name: 'Crear desde cero' }).click({ timeout: 8000 });
  console.log('Click hecho');
  await page.waitForTimeout(1000);
  console.log('URL tras click:', page.url());
  await page.screenshot({ path: 'screenshots/audit_04_result.png', fullPage: true });
  console.log('Screenshot guardado');
} catch (e) {
  console.log('ERROR:', e.message);
  await page.screenshot({ path: 'screenshots/audit_04_error.png', fullPage: true }).catch(() => {});
}
await browser.close();
console.log('DONE');
