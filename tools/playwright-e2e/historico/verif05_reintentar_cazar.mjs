import { chromium } from 'playwright';

const SAVE_ID = 'cmteh1ax3003frietev2anlpo';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

const campo = page.locator('[contenteditable="true"][aria-label="Acción de tu personaje"]');
await campo.click();
await campo.fill('Sigo rastreando por la Hondonada del Eco, decidido a dar caza al Kirelon Arenoso que hay por la zona.');
await page.waitForTimeout(300);
const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
await actuarBtn.click();
console.log('turno enviado: reintento de caza');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/verif05_turno_enviado.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(0, 2000));

await browser.close();
console.log('OK');
