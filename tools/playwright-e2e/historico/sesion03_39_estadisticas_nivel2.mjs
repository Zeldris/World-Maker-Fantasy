import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

await page.getByText('Personaje', { exact: true }).click();
await page.waitForTimeout(1200);
const statsBtn = page.locator('button', { hasText: 'Estadísticas' });
await statsBtn.first().click({ force: true });
await page.waitForTimeout(1200);
console.log('--- ESTADÍSTICAS NIVEL 2 ---');
console.log(await page.locator('body').innerText());
await page.screenshot({ path: 'screenshots/sesion03_39_estadisticas.png', fullPage: true });

await browser.close();
console.log('OK');
