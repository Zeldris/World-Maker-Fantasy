import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
const allTajo = await page.locator('text=Tajo Horizontal').all();
// El del panel visible del combate real (menor y, ya que boundingBox usa coords absolutas del
// documento, filtramos por x > 900 que es la columna del panel de combate).
let target = null;
for (const loc of allTajo) {
  const box = await loc.boundingBox();
  if (box && box.x > 900) { target = loc; break; }
}
if (!target) { console.log('No se encontró el candidato real'); process.exit(1); }
await target.scrollIntoViewIfNeeded();
await target.click();
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr35_tras_click.png', fullPage: true });
const actuarBtn = page.getByRole('button', { name: /^actuar$/i, disabled: false }).first();
await actuarBtn.click({ timeout: 10000 });
console.log('Ataque enviado, esperando...');
await page.waitForTimeout(28000);
console.log(await page.locator('body').innerText());
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr35_resultado.png', fullPage: true });
await browser.close();
