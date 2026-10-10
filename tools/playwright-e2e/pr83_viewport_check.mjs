import { getPage } from './_conn.mjs';

const { page } = await getPage();
const vp = page.viewportSize();
console.log('viewport', vp);

// Find the button with text exactly 🗺️Mapa and check visibility state details
const info = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('button'));
  const btn = nodes.find(n => n.textContent.trim() === '🗺️Mapa');
  if (!btn) return 'not found';
  const style = window.getComputedStyle(btn);
  return {
    rect: btn.getBoundingClientRect(),
    display: style.display,
    visibility: style.visibility,
    opacity: style.opacity,
    parentClass: btn.parentElement.className,
  };
});
console.log(JSON.stringify(info, null, 1));
