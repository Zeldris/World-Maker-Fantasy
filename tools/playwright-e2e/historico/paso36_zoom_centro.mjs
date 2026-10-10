import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
await page.getByRole('button', { name: '🗺️ Mapa' }).click();
await page.waitForTimeout(1500);
// Recorte de la zona central del SVG (donde están Torgash/Ulkha según el catálogo)
const svg = page.locator('svg').first();
const box = await svg.boundingBox();
await page.screenshot({
  path: 'screenshots/paso36_zoom_centro.png',
  clip: { x: box.x + box.width * 0.3, y: box.y + box.height * 0.4, width: box.width * 0.4, height: box.height * 0.4 },
});
await browser.close();
