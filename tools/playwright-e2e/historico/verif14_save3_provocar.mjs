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
await campo.fill('Un Kirelon Arenoso surge de la arena junto a mí y me ataca. Le hago frente con mi hacha.');
await page.waitForTimeout(300);
const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
await actuarBtn.click();
console.log('--- turno enviado: encuentro directo con Kirelon ---');
await page.waitForTimeout(4000);
await page.screenshot({ path: 'screenshots/verif14_tras_enviar.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(-1800));

await browser.close();
console.log('OK');
