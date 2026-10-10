import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(400, 661);
await page.waitForTimeout(300);
await page.keyboard.type('Miro alrededor del pozo buscando qué otras criaturas hay cerca.', { delay: 15 });
await page.waitForTimeout(300);
await page.mouse.click(1202, 654);
console.log('sent');
