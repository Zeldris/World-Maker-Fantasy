import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();

const input = page.getByRole('textbox', { name: /acción de tu personaje/i });
await input.click();
await input.fill('Gorhorn ignora a la orca por ahora y avanza directo hacia un Kirelon Arenoso que ve moverse entre las rocas, atacándolo con su hacha de guerra rota.');
await page.getByRole('button', { name: /^actuar$/i }).nth(0).click();

console.log('Esperando resolución del turno (hasta 60s)...');
let bodyText = await page.locator('body').innerText();
for (let i=0;i<15;i++){
  await page.waitForTimeout(4000);
  bodyText = await page.locator('body').innerText();
  const waiting = bodyText.includes('NARRADOR ESCRIBE') || bodyText.includes('Esperando la narración');
  console.log(`t=${(i+1)*4}s esperando=${waiting}`);
  if (!waiting) break;
}
await snap(page, 'step25_resultado');
await browser.close();
console.log('OK');
