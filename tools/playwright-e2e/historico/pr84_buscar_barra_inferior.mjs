import { getPage } from './_conn.mjs';

const { page } = await getPage();
const info = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('button'));
  return nodes
    .map(n => ({ text: n.textContent.trim().slice(0,20), rect: n.getBoundingClientRect(), visibility: window.getComputedStyle(n).visibility }))
    .filter(n => n.visibility !== 'hidden' && n.rect.width > 0 && n.rect.height > 0)
    .filter(n => ['Mapa','Diario','Misiones','Reputación','Enciclopedia','ACTUAR'].some(k => n.text.includes(k)));
});
console.log(JSON.stringify(info, null, 1));
