import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

await page.getByText('Enciclopedia', { exact: true }).click();
await page.waitForTimeout(1500);
await page.locator('button[title="Fauna"]').click();
await page.waitForTimeout(1200);

// Clicar el botón .tactile que contiene el texto de la región (más específico).
const regionBtn = page.locator('button.tactile', { hasText: 'LLANURAS DEL VIENTO ROJO' });
console.log('botones región encontrados:', await regionBtn.count());
await regionBtn.first().click({ force: true });
await page.waitForTimeout(1200);
console.log('--- FAUNA EXPANDIDA ---');
console.log(await page.locator('body').innerText());
await page.screenshot({ path: 'screenshots/sesion02_64_fauna_expandida.png', fullPage: true });

await browser.close();
console.log('OK');
