import { getPage } from './_conn.mjs';

const { page } = await getPage();
const info = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('button'));
  return nodes.map(n => ({
    text: n.textContent.trim().slice(0, 40),
    visible: !!(n.offsetWidth || n.offsetHeight),
    rect: n.getBoundingClientRect(),
  })).filter(n => n.visible);
});
console.log(JSON.stringify(info, null, 1).slice(0, 4000));
