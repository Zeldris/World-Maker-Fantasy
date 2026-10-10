import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(1211, 69);
await page.waitForTimeout(600);
// Click "Bulco de Arena" entity chip in log
await page.mouse.click(205, 497);
await page.waitForTimeout(1000);
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/bulco_ficha.png' });
console.log('saved');
