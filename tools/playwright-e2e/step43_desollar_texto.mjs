import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();

// Cerrar cualquier modal abierto primero
const closeBtn = page.locator('button', { hasText: /^cerrar$/i }).first();
if ((await closeBtn.count()) > 0 && (await closeBtn.isVisible())) {
  await closeBtn.click();
  await page.waitForTimeout(500);
}

const buttons = await page.getByRole('button').allInnerTexts();
console.log('Modo actual (combatir/huir presentes?):', buttons.includes('⚔️ COMBATIR'));

const input = page.getByRole('textbox', { name: /acción de tu personaje/i });
await input.click();
await input.fill('Gorhorn se arrodilla junto al cadáver del Kirelon Arenoso y comienza a desollarlo con su cuchillo, para aprovechar su piel, huesos y garras.');
await page.getByRole('button', { name: /^actuar$/i }).nth(0).click();

console.log('Esperando resolución...');
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
await snap(page, 'step43_resultado');
await browser.close();
console.log('OK');
