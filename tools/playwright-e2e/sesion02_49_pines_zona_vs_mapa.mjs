import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

await page.getByText('Mapa', { exact: true }).first().click();
await page.waitForTimeout(2000);

// Estamos en la pestaña "Zona" por defecto. Buscar pines/SVG clicables.
const svgCircles = await page.locator('svg circle, svg [role="button"], [class*="pin"]').count();
console.log('Elementos tipo pin en Zona:', svgCircles);

// Intentar clicar un pin de la leyenda "Boca de cueva (Kirelon Arenoso) x20"
const bodyBefore = await page.locator('body').innerText();
console.log('--- ZONA ANTES ---');
console.log(bodyBefore.slice(bodyBefore.indexOf('LEYENDA'), bodyBefore.indexOf('LEYENDA') + 500));

// Buscar elementos posicionados absolutamente dentro del contenedor del mapa (candidatos a pin).
const pinInfo = await page.evaluate(() => {
  const candidates = [...document.querySelectorAll('[style*="left"][style*="top"], [style*="position: absolute"]')];
  return candidates.slice(0, 10).map(el => ({
    tag: el.tagName,
    cls: el.className?.toString().slice(0, 80),
    text: el.textContent?.slice(0, 40),
  }));
});
console.log('--- CANDIDATOS A PIN (posicionados absolutamente) ---');
console.log(JSON.stringify(pinInfo, null, 1));

await browser.close();
console.log('OK');
