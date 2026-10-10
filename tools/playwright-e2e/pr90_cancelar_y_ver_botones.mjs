import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.getByText('CANCELAR', { exact: true }).click();
await page.waitForTimeout(500);
// Instead click directly on the point again but look for a "mover aqui" confirm button after single click reveals info differently.
// Let's inspect all buttons in modal now.
const info = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('button'));
  return nodes.map(n => n.textContent.trim()).filter(Boolean);
});
console.log(JSON.stringify(info));
