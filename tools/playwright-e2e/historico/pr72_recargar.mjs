import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(1500);
console.log('Recargado. URL:', page.url());
