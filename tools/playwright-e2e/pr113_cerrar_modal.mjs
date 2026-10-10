import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(1211, 69);
await page.waitForTimeout(500);
console.log('closed');
