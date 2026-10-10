import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill("Persigo al 'Quio' herido y remato el trabajo con otro golpe.");
await page.waitForTimeout(300);
await page.keyboard.press('Enter');
console.log('Turno de remate enviado, esperando hasta 60s...');
await page.waitForTimeout(60000);
await page.screenshot({ path: 'screenshots/sesion03_35_tras_rematar.png', fullPage: true });
console.log(await page.locator('body').innerText());

await browser.close();
console.log('OK');
