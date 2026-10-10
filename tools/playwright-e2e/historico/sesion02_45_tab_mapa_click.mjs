import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

await page.getByText('Mapa', { exact: true }).first().click();
await page.waitForTimeout(2000);

// Las pestañas "Zona"/"Mapa" están al final del drawer, tras "Cerrar ✕".
const tabs = page.locator('button', { hasText: /^Mapa$/ });
const tabCount = await tabs.count();
console.log('Botones "Mapa" encontrados:', tabCount);
// El último suele ser la pestaña interna.
await tabs.last().click();
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/sesion02_45_tab_mapa_amplio.png', fullPage: true });
console.log('--- TRAS CLIC EN PESTAÑA MAPA ---');
console.log(await page.locator('body').innerText());

await browser.close();
console.log('OK');
