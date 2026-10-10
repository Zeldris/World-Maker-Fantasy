import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(1202, 654);
console.log('clicked ACTUAR, waiting...');
await page.waitForTimeout(20000);
const text = await page.evaluate(() => document.body.innerText);
console.log(text.slice(0, 3000));
