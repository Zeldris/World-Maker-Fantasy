import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

await page.getByText('Enciclopedia', { exact: true }).click();
await page.waitForTimeout(1500);

// Clicar el botón de categoría Fauna por su title exacto (evita el span "Fauna" duplicado en breadcrumbs).
await page.locator('button[title="Fauna"]').click();
await page.waitForTimeout(1500);
console.log('--- ENCICLOPEDIA: FAUNA ---');
console.log(await page.locator('body').innerText());
await page.screenshot({ path: 'screenshots/sesion02_62_fauna.png', fullPage: true });

await browser.close();
console.log('OK');
