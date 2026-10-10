import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/fresco102.png' });
const info = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('textarea, input, [contenteditable="true"]'));
  return els.map(e => ({ tag: e.tagName, placeholder: e.getAttribute('placeholder'), rect: e.getBoundingClientRect() }));
});
console.log(JSON.stringify(info, null, 1));
