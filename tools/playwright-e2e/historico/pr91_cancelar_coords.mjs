import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(639, 418);
await page.waitForTimeout(600);
const info = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('button'));
  return nodes.map(n => n.textContent.trim()).filter(Boolean);
});
console.log(JSON.stringify(info));
