import { getPage } from './_conn.mjs';

const { page } = await getPage();
// El log parece estar en un contenedor scrolleable. Buscar y bajar al final.
const text = await page.evaluate(() => document.body.innerText);
console.log('LEN:', text.length);
console.log('---LAST 3000---');
console.log(text.slice(-3000));
