import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Le pregunto a Gistera Koh qué sabe sobre el Clan Serhu y por qué la persiguen.');
await page.waitForTimeout(300);
await page.keyboard.press('Enter');
console.log('Turno de diálogo con Gistera enviado, esperando hasta 60s...');
await page.waitForTimeout(60000);
await page.screenshot({ path: 'screenshots/sesion03_04_tras_dialogo.png', fullPage: true });
console.log(await page.locator('body').innerText());

await browser.close();
console.log('OK');
