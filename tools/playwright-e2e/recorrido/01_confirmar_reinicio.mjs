import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.setDefaultTimeout(15000);

await page.goto('http://localhost:5173/');
await page.waitForTimeout(1500);
await page.getByText('En solitario').click();
await page.waitForTimeout(1500);
await page.getByText('Helek Sirik', { exact: false }).first().click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Continuar →' }).click();
await page.waitForTimeout(1000);
await page.getByText('Gorhorn', { exact: true }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Continuar →' }).click();
await page.waitForTimeout(1500);

await page.getByRole('button', { name: '↺ Reiniciar' }).first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/recorrido_01_confirmacion.png', fullPage: true });

const confirmar = page.getByRole('button', { name: 'Reiniciar', exact: true });
if (await confirmar.isVisible().catch(() => false)) {
  await confirmar.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/recorrido_01b_tras_reinicio.png', fullPage: true });
  console.log('Reiniciado');
}

await browser.close();
