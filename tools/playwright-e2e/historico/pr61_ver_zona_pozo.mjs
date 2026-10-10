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
console.log(await page.locator('body').innerText());
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr61_zona_pozo.png', fullPage: true });
await browser.close();
