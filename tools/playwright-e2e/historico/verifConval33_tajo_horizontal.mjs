import { chromium } from 'playwright';

const SAVE_ID = 'cmtd4qgfk003lriuof6id16e0';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const combatirBtn = page.locator('button', { hasText: 'COMBATIR' }).last();
await combatirBtn.click();
await page.waitForTimeout(1000);

const objetivo = page.locator('button', { hasText: 'Gesgurio #2' });
await objetivo.click();
await page.waitForTimeout(500);

// Click en la habilidad "Tajo Horizontal" para insertarla en el campo
const habilidad = page.locator('text=Tajo Horizontal').first();
await habilidad.click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/verifConval33_habilidad_click.png', fullPage: true });

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
await actuarBtn.click();
console.log('--- turno de combate enviado (tajo horizontal) ---');
await page.waitForTimeout(35000);
await page.screenshot({ path: 'screenshots/verifConval33_despues.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(-2000));

await browser.close();
console.log('OK');
