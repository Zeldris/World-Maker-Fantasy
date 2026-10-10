import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const opcion = page.getByRole('button', { name: /aceptar ayudarla/i });
await opcion.waitFor({ state: 'visible', timeout: 10000 });
await opcion.click();
console.log('Elegido "Aceptar ayudarla", esperando respuesta...');

await page.waitForTimeout(45000);

await page.screenshot({ path: 'checklist0922_26_tras_aceptar.png', fullPage: true });
console.log('Captura tomada.');

await browser.close();
