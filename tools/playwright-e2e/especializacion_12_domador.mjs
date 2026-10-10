import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (msg) => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:5173/solitario/partida/cmthl2fb4000wrixt2hckti84', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

await page.getByText('Domador', { exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/especializacion_12_domador_detalle.png', fullPage: true });

await page.getByRole('button', { name: 'Aceptar' }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Confirmar' }).click();
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/especializacion_13_domador_confirmado.png', fullPage: true });

await browser.close();
