import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Avanzo explorando la hondonada, buscando rastros de criaturas o peligro cerca.');

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
await actuarBtn.click();

console.log('Turno enviado, esperando resolución (hasta 40s)...');
await page.waitForTimeout(35000);

await page.screenshot({ path: 'checklist0922_02_tras_turno.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log('--- Últimos 2000 chars del body ---');
console.log(bodyText.slice(-2000));

await browser.close();
