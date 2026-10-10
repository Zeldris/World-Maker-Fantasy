import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(76, 158);
await page.waitForTimeout(1200);
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/tras_mover_quio.png' });
const text = await page.evaluate(() => document.body.innerText);
console.log(text.slice(0, 2000));
