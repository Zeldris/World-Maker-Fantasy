import { chromium } from 'playwright';

const SAVE_ID = 'cmthp1jyu0009rij1xf2ri09m';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'Mapa' }).click();
await page.waitForTimeout(1500);

const svg = page.locator('svg').first();
await svg.scrollIntoViewIfNeeded();
const box = await svg.boundingBox();
console.log('SVG box:', box);

// Buscar el modal en sí y hacer scroll dentro
const modal = page.locator('text=La Hondonada del Eco').locator('../..');
await modal.evaluate((el) => { el.scrollTop = el.scrollHeight; });
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/zona_hondonada_03.png', fullPage: true });

await browser.close();
