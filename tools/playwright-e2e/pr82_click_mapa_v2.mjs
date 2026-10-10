import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(642 + 30, 188 + 14);
await page.waitForTimeout(1500);
const text = await page.evaluate(() => document.body.innerText);
console.log('---AFTER---');
console.log(text.slice(0, 2000));
