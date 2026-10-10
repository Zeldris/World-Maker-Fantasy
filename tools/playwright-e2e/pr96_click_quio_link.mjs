import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(145, 315); // Quio link in log
await page.waitForTimeout(1000);
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/tras_click_quio_link.png' });
const text = await page.evaluate(() => document.body.innerText);
console.log(text.slice(0, 2000));
