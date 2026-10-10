import { getPage } from './_conn.mjs';

const { page } = await getPage();
const input = page.locator('textarea, input[type="text"]').first();
await input.click();
await input.fill('Me acerco despacio a Quio para observarlo de cerca antes de decidir si cazarlo.');
await page.waitForTimeout(300);
await page.mouse.click(1202, 654); // ACTUAR button
console.log('sent action, waiting for response...');
await page.waitForTimeout(15000);
const text = await page.evaluate(() => document.body.innerText);
console.log(text.slice(0, 2500));
