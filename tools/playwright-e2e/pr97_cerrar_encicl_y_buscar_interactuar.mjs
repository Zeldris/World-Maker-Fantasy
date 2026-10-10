import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const info = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('button'));
  return nodes
    .map(n => ({ text: n.textContent.trim(), rect: n.getBoundingClientRect() }))
    .filter(n => /interactuar/i.test(n.text));
});
console.log(JSON.stringify(info));
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/tras_escape.png' });
