import { getPage } from './_conn.mjs';

const { page } = await getPage();
// Buscar el botón/icono de Mapa (🗺️) en la barra de tabs
const clicked = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('button, [role="button"], a, div'));
  const target = nodes.find(n => n.textContent.trim() === 'Mapa' || (n.children.length === 0 && n.textContent.includes('Mapa')));
  return target ? 'found candidate' : 'not found';
});
console.log(clicked);

// Try clicking by text 'Mapa'
try {
  await page.getByText('Mapa', { exact: true }).first().click({ timeout: 5000 });
  console.log('clicked Mapa');
} catch (e) {
  console.log('click failed:', e.message);
}

await page.waitForTimeout(1000);
const text = await page.evaluate(() => document.body.innerText);
console.log('---AFTER CLICK---');
console.log(text.slice(0, 2000));
