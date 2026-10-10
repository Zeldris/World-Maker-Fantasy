import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(640, 573);
await page.waitForTimeout(1000);
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/mapa118.png' });
console.log('saved');
