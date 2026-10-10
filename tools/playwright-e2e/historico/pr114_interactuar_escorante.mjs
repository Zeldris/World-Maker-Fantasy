import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(400, 661);
await page.waitForTimeout(300);
await page.keyboard.type('Me acerco al Escorante y trato de ganarme su confianza con más comida.', { delay: 15 });
await page.waitForTimeout(300);
await page.mouse.click(1202, 654);
console.log('sent');
