import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(640, 573); // brujula flotante
await page.waitForTimeout(1000);
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/mapa_tras_caza.png' });
console.log('saved');
