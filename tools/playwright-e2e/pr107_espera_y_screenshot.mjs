import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.waitForTimeout(25000);
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/resultado107.png' });
console.log('saved');
