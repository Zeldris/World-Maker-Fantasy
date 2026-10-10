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

// Clic explícito en la tarjeta de Gorhorn para habilitar "Continuar"
await page.getByText('Gorhorn', { exact: true }).first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/recorrido_00d_tras_click_gorhorn.png', fullPage: true });

const continuar = page.getByRole('button', { name: 'Continuar →' });
console.log('Continuar habilitado:', await continuar.isEnabled().catch(() => false));
if (await continuar.isEnabled().catch(() => false)) {
  await continuar.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/recorrido_00e_saves.png', fullPage: true });
}

await browser.close();
