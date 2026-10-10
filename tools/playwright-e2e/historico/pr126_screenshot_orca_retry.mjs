import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/resultado126.png' });
console.log('saved');
