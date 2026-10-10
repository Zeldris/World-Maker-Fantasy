import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
page.on('console', msg => { if (msg.type() === 'error') console.log('[console error]', msg.text()); });
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Exploro la Hondonada del Eco, atento a cualquier señal de peligro o de recursos útiles.');
await page.getByRole('button', { name: /^actuar$/i }).click();
await page.waitForTimeout(30000);
await page.screenshot({ path: 'screenshots/sesion02_13_explorar.png', fullPage: true });
console.log(await page.locator('body').innerText());
await browser.close();
console.log('OK');
