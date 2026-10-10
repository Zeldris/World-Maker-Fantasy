import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
// Buscar un botón "Curar" en el panel de personaje/inventario.
const curarBtn = page.getByText('Curar', { exact: false }).first();
const count = await curarBtn.count();
console.log('botones Curar encontrados:', count);
if (count > 0) {
  await curarBtn.click();
  await page.waitForTimeout(1500);
  console.log(await page.locator('body').innerText());
  await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr53_curar.png', fullPage: true });
} else {
  console.log('No hay botón Curar visible en el panel actual.');
}
await browser.close();
