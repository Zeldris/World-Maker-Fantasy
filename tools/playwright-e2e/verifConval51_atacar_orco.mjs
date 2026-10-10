import { chromium } from 'playwright';

const SAVE_ID = 'cmten4peu008aritr6km5hcc9';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const combatirBtn = page.locator('button', { hasText: 'COMBATIR' }).last();
await combatirBtn.click();
await page.waitForTimeout(1000);

const campo = page.getByPlaceholder(/describe tu acci/i);
await campo.click();
await campo.fill('Ataco al Orco enfurecido con mi hacha, un golpe directo.');
await page.waitForTimeout(300);

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
await actuarBtn.click();
console.log('--- turno de combate enviado ---');
await page.waitForTimeout(35000);
await page.screenshot({ path: 'screenshots/verifConval51_despues.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(-2000));

await browser.close();
console.log('OK');
