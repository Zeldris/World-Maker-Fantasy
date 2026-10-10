import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.wheel(0, 500);
await page.waitForTimeout(500);
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/inventario109.png' });
const text = await page.evaluate(() => document.body.innerText);
console.log(text.slice(0, 2500));
