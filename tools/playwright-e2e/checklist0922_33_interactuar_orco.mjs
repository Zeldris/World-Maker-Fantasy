import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const interactuarBtn = page.getByRole('button', { name: /^interactuar$/i });
await interactuarBtn.waitFor({ state: 'visible', timeout: 10000 });
await interactuarBtn.click();
console.log('Pulsado INTERACTUAR con el Orco Enfurecido, esperando...');

await page.waitForTimeout(45000);

await page.screenshot({ path: 'checklist0922_33_tras_interactuar_orco.png', fullPage: true });
console.log('Captura tomada.');

await browser.close();
