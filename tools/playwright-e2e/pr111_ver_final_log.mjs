import { getPage } from './_conn.mjs';

const { page } = await getPage();
const text = await page.evaluate(() => document.body.innerText);
console.log(text.slice(-2500));
