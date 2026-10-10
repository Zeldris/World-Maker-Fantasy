import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(616 + 24, 549 + 24);
await page.waitForTimeout(1000);
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/brujula1.png' });
const text = await page.evaluate(() => document.body.innerText);
console.log(text.slice(0, 1500));
