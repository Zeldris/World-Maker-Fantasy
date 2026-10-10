import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
const buttons = await page.locator('button').all();
let brujulaBtn = null;
for (const btn of buttons) {
  const text = (await btn.innerText().catch(() => '')).trim();
  if (text === '🧭') { brujulaBtn = btn; break; }
}
await brujulaBtn.click();
await page.waitForTimeout(1500);
const svg = page.locator('svg').first();
const box = await svg.boundingBox();
// Un paso más directo hacia el triángulo (arriba del todo).
await page.mouse.click(box.x + box.width * 0.52, box.y + box.height * 0.08);
await page.waitForTimeout(5000);
console.log(await page.locator('body').innerText());
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr15_colision.png', fullPage: true });
await browser.close();
