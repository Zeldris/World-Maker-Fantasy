import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
// El panel de combate vive en el segundo columna — acotar la búsqueda a esa región para no
// coincidir con menciones de la habilidad en el historial de la izquierda.
const panel = page.locator('text=/COMBATE.*ATAQUE|COMBATE.*DEFENSA/i').first();
await panel.scrollIntoViewIfNeeded().catch(() => {});
const allTajo = await page.locator('text=Tajo Horizontal').all();
console.log('Tajo Horizontal encontrados:', allTajo.length);
for (const [i, loc] of allTajo.entries()) {
  const box = await loc.boundingBox();
  console.log(i, JSON.stringify(box));
}
await browser.close();
