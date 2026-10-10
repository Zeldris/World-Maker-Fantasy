import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(1029, 169); // Cerrar
await page.waitForTimeout(500);
const text = await page.evaluate(() => document.body.innerText);
console.log(text.slice(0, 3000));
