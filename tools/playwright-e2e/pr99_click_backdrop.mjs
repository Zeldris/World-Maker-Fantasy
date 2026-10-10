import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(50, 680); // far bottom left, likely backdrop
await page.waitForTimeout(800);
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/tras_backdrop_click.png' });
