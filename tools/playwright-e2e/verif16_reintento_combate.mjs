import { chromium } from 'playwright';

const SAVE_ID = 'cmtegylxo0001rietdx8zyloy';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

const campo = page.locator('[contenteditable="true"][aria-label="Acción de tu personaje"]');
await campo.click();
await campo.fill('Golpeo con fuerza al Kirelon Arenoso que me ataca, hacha en alto.');
await page.waitForTimeout(300);
const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
await actuarBtn.click();
console.log('--- turno reenviado ---');
await page.waitForTimeout(4000);
const bodyText1 = await page.locator('body').innerText();
console.log('--- tras 4s ---');
console.log(bodyText1.slice(-800));

await browser.close();
console.log('OK');
