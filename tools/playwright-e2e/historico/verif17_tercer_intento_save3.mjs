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
await campo.fill('Le asesto un hachazo directo al Kirelon Arenoso que me ataca.');
await page.waitForTimeout(300);
const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
await actuarBtn.click();
console.log('--- turno enviado (tercer intento save3) ---');

await browser.close();
console.log('OK enviado, cerrando navegador para no mantener conexion abierta');
