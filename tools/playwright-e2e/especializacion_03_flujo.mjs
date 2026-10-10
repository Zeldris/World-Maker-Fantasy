import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (msg) => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:5173/solitario/partida/cmthl2fb4000wrixt2hckti84', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

// Click en "Instintivo"
await page.getByText('Instintivo', { exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/especializacion_03_detalle.png', fullPage: true });

// Click en "Atrás"
await page.getByRole('button', { name: 'Atrás' }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/especializacion_04_lista_de_nuevo.png', fullPage: true });

// Volver a elegir Instintivo
await page.getByText('Instintivo', { exact: true }).click();
await page.waitForTimeout(500);

// Click en "Aceptar" -> debería mostrar confirmación
await page.getByRole('button', { name: 'Aceptar' }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/especializacion_05_confirmacion.png', fullPage: true });

await browser.close();
