import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
console.log(await page.locator('body').innerText());
await browser.close();
