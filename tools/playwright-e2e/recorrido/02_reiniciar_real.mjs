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

const botonReiniciar = page.getByRole('button', { name: '↺ Reiniciar' }).first();
const box = await botonReiniciar.boundingBox();
console.log('Botón Reiniciar boundingBox:', JSON.stringify(box));
// Clic con force en el centro exacto del botón pequeño, para evitar que Playwright resuelva
// el evento contra el contenedor padre (role="button") que lo envuelve.
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(800);
await page.screenshot({ path: 'screenshots/recorrido_02_tras_click.png', fullPage: true });

const confirmar = page.getByRole('button', { name: 'Reiniciar', exact: true });
console.log('Modal confirmación visible:', await confirmar.isVisible().catch(() => false));

await browser.close();
