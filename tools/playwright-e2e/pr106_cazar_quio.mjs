import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(400, 661);
await page.waitForTimeout(300);
await page.keyboard.type('Intento cazar a Quio con sigilo.', { delay: 15 });
await page.waitForTimeout(300);
await page.mouse.click(1202, 654);
console.log('sent, waiting...');
await page.waitForTimeout(20000);
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/resultado106.png' });
console.log('saved');
