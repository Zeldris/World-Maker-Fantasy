import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Reviso mi mochila buscando algo útil que se me haya pasado por alto.');
await page.waitForTimeout(300);
await page.keyboard.press('Enter');
console.log('Segundo intento enviado, esperando hasta 45s...');
await page.waitForTimeout(45000);
await page.screenshot({ path: 'screenshots/sesion03_30_reproducir.png', fullPage: true });
console.log(await page.locator('body').innerText());

await browser.close();
console.log('OK');
