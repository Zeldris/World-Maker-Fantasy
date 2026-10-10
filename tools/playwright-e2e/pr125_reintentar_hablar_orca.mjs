import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(400, 661);
await page.waitForTimeout(300);
await page.keyboard.type('Me giro hacia la orca del Clan Serhu, la que lleva la marca en el brazo, y le hablo directamente a ella, ignorando cualquier otra cosa.', { delay: 15 });
await page.waitForTimeout(300);
await page.mouse.click(1202, 654);
console.log('sent');
