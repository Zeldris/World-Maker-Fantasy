import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.setDefaultTimeout(30000);

await page.goto('http://localhost:5173/');
await page.waitForTimeout(1500);
await page.getByText('En solitario').click();
await page.waitForTimeout(1500);
await page.getByText('Helek Sirik', { exact: false }).first().click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Continuar →' }).click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Continuar →' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/recorrido_00c_saves.png', fullPage: true });

const fila = page.locator('text=TEST Claude - no tocar');
console.log('Fila "TEST Claude - no tocar" visible:', await fila.isVisible().catch(() => false));

await browser.close();
