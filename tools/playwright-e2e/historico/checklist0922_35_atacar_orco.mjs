import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

await page.getByRole('button', { name: /combatir/i }).click().catch(() => {});
await page.waitForTimeout(1500);

const composer = page.locator('input[placeholder="O describe tu acción..."]');
await composer.waitFor({ state: 'visible', timeout: 10000 });
await composer.click();
await composer.fill('Ataco con un golpe directo, con el arma que llevo en la mano principal, contra el Orco enfurecido.');

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
await actuarBtn.click();
console.log('Ataque enviado, esperando resolución...');

await page.waitForTimeout(45000);

await page.screenshot({ path: 'checklist0922_35_tras_atacar.png', fullPage: true });
console.log('Captura tomada.');

await browser.close();
