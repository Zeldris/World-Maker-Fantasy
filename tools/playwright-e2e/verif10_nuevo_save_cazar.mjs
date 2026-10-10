import { chromium } from 'playwright';

const SAVE_ID = 'cmtegz0b4001qrieti2l0z1iu';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

const campo = page.locator('[contenteditable="true"][aria-label="Acción de tu personaje"]');
await campo.click();
await campo.fill('Salgo a cazar al Kirelon Arenoso que ronda La Hondonada del Eco.');
await page.waitForTimeout(300);
const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
await actuarBtn.click();
console.log('--- turno enviado: cazar Kirelon (save nuevo) ---');
await page.waitForTimeout(4000);
await page.screenshot({ path: 'screenshots/verif10_tras_enviar.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(-1800));

await browser.close();
console.log('OK');
