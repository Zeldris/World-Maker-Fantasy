import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const brujula = page.locator('button[title="Moverte por la zona"]');
await brujula.click();
await page.waitForTimeout(1500);

// El mapa es un <svg> con viewBox real 800x600 (según memoria: cuadrícula 16x12, celdas 50px).
// Buscamos el SVG del mapa en sí (el más grande, con el marcador del jugador).
const mapSvg = page.locator('svg').filter({ has: page.locator('*') }).last();

// Clic directo sobre el círculo naranja de fauna visible en el screenshot anterior
// (coordenadas de pantalla aproximadas: x=161, y=805 en el screenshot fullPage 1400x1000)
await page.mouse.click(161, 805);
console.log('Clic en el punto de fauna enviado, esperando movimiento...');

for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(1000);
}

await page.screenshot({ path: 'checklist0922_19_tras_click.png', fullPage: true });
console.log('Captura tomada.');

await browser.close();
