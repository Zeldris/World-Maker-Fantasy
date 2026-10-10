import { getPage } from './_conn.mjs';

const { page } = await getPage();
const info = await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll('*')).find(n => n.getAttribute && n.getAttribute('placeholder') === '¿Qué hace tu personaje?');
  if (!el) return 'not found';
  return { tag: el.tagName, rect: el.getBoundingClientRect(), outerHTML: el.outerHTML.slice(0,300) };
});
console.log(JSON.stringify(info, null, 1));
