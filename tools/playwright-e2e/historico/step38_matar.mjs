import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);

await page.getByRole('button', { name: /^matar$/i }).click();
console.log('Click en MATAR enviado. Esperando resolución...');

let bodyText = await page.locator('body').innerText();
for (let i=0;i<20;i++){
  const waiting = /RESOLVIEND|NARRADOR ESCRIBE|Esperando la narración/i.test(bodyText);
  if (!waiting) break;
  await page.waitForTimeout(4000);
  bodyText = await page.locator('body').innerText();
  console.log(`t=${(i+1)*4}s esperando=${waiting}`);
}
await page.waitForTimeout(2000);
const scrollable = page.locator('div', { has: page.getByText('Ver historial completo en el Diario') }).last();
await scrollable.evaluate(el => { el.scrollTop = el.scrollHeight; });
await page.waitForTimeout(300);
await snap(page, 'step38_resultado');
await browser.close();
console.log('OK');
