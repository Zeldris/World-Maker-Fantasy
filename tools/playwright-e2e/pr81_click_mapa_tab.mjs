import { getPage } from './_conn.mjs';

const { page } = await getPage();
const info = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('button'));
  return nodes
    .filter(n => n.textContent.includes('Mapa'))
    .map(n => ({ text: n.textContent.trim(), rect: n.getBoundingClientRect() }));
});
console.log(JSON.stringify(info));

if (info.length) {
  const el = page.locator('button', { hasText: 'Mapa' }).first();
  await el.click();
  await page.waitForTimeout(1500);
  const text = await page.evaluate(() => document.body.innerText);
  console.log('---AFTER---');
  console.log(text.slice(0, 1500));
}
