import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();

const input = page.getByRole('textbox', { name: /acción de tu personaje/i });
await input.click();
await input.fill('Gorhorn, ya recuperado, vuelve a rastrear un Kirelon Arenoso u otra fauna de La Hondonada del Eco para atacarla sin dudar en cuanto la vea.');
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
await snap(page, 'step37_resultado');
await browser.close();
console.log('OK');
