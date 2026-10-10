import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(810, 563);
await page.waitForTimeout(500);
console.log('closed');
