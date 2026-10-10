import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:5173/solitario/partida/cmtj5zvk1003uriri0iuzjw6m', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.getByText('Cazador', { exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/fix03_08_detalle.png', fullPage: true });

await page.getByRole('button', { name: 'Aceptar' }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Confirmar' }).click();
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/fix03_09_confirmado.png', fullPage: true });

await browser.close();
