import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(41, 157); // Inventario tab
await page.waitForTimeout(1000);
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/inventario108.png' });
console.log('saved');
