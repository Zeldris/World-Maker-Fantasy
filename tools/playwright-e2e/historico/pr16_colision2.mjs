import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
const svg = page.locator('svg').first();
const box = await svg.boundingBox();
// Clic directo sobre el triángulo (Orco), un poco por debajo de mi estrella.
await page.mouse.click(box.x + box.width * 0.585, box.y + box.height * 0.28);
await page.waitForTimeout(5000);
console.log(await page.locator('body').innerText());
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr16_colision2.png', fullPage: true });
await browser.close();
