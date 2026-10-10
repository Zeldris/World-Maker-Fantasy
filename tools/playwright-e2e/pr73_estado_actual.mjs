import { getPage } from './_conn.mjs';

const { page } = await getPage();
const bodyText = await page.evaluate(() => document.body.innerText).catch((e) => `ERROR: ${e.message}`);
console.log(bodyText.slice(0, 2200));
