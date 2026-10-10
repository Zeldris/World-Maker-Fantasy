import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.getByText('Cerrar').first().click();
await page.waitForTimeout(800);
// Buscar icono de brújula flotante
const info = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('button'));
  return nodes
    .map(n => ({ text: n.textContent.trim().slice(0,10), aria: n.getAttribute('aria-label'), rect: n.getBoundingClientRect() }))
    .filter(n => (n.aria && /mover|brujula|brújula|zona/i.test(n.aria)) || /🧭/.test(n.text));
});
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/tras_cerrar.png' });
