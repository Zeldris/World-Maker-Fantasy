import { getPage } from './_conn.mjs';

const { page } = await getPage();
// Click empty cell near the well (395, 390) - center path area
await page.mouse.click(395, 340);
await page.waitForTimeout(1000);
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/tras_click_celda_vacia.png' });
const text = await page.evaluate(() => document.body.innerText);
console.log(text.slice(0, 1500));
