import { getPage } from './_conn.mjs';

const { page } = await getPage();
const url = page.url();
const text = await page.evaluate(() => document.body.innerText);
console.log('URL:', url);
console.log('---TEXT---');
console.log(text.slice(0, 3000));
