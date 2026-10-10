import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
// El lienzo del mapa (viewBox 800x600) — clic cerca del triángulo del Orco Enfurecido, un poco
// por debajo para no caer justo encima del icono y perder el listener del lienzo.
const svg = page.locator('svg').first();
const box = await svg.boundingBox();
console.log('SVG box:', JSON.stringify(box));
// El triángulo está aprox en (395, 245) dentro de la imagen mostrada (750x600 aprox visible) —
// clicamos un poco más abajo, en la zona despejada hacia el norte.
await page.mouse.click(box.x + box.width * 0.52, box.y + box.height * 0.42);
await page.waitForTimeout(4000);
console.log(await page.locator('body').innerText());
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr12_tras_mover.png', fullPage: true });
await browser.close();
