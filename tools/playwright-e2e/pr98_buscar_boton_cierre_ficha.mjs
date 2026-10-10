import { getPage } from './_conn.mjs';

const { page } = await getPage();
const info = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('button, [role="button"]'));
  return nodes
    .map(n => ({ text: n.textContent.trim().slice(0,20), aria: n.getAttribute('aria-label'), rect: n.getBoundingClientRect() }))
    .filter(n => n.rect.top < 90 && n.rect.left > 700);
});
console.log(JSON.stringify(info, null, 1));
