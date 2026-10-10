import { getPage } from './_conn.mjs';

const { page } = await getPage();
// Click the orange dot near top-center (363,262) closest to star (74,163)
await page.mouse.click(363, 262);
await page.waitForTimeout(1000);
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/tras_click_punto.png' });
const text = await page.evaluate(() => document.body.innerText);
console.log(text.slice(0, 2000));
