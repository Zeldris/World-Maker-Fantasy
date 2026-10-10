import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();

// Abrir panel de combate
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);

// El botón ACTUAR del panel de combate (distinto del de texto libre) - usar el input de descripción o el botón directo
// Probar con el textbox de combate "O describe tu acción..."
const combatInput = page.locator('div[contenteditable="true"]').last();
await combatInput.click();
await combatInput.fill('Gorhorn ataca con fuerza al Kirelon Arenoso con su hacha de guerra rota.');

// Botón ACTUAR del panel de combate (nth 1, según gotcha del README hay 2 en el DOM)
const actuarBtns = page.getByRole('button', { name: /^actuar$/i });
console.log('n actuar btns:', await actuarBtns.count());
await actuarBtns.last().click();

console.log('Esperando resolución del turno de combate...');
let bodyText = await page.locator('body').innerText();
for (let i=0;i<15;i++){
  await page.waitForTimeout(4000);
  bodyText = await page.locator('body').innerText();
  const waiting = bodyText.includes('NARRADOR ESCRIBE') || bodyText.includes('Esperando la narración');
  console.log(`t=${(i+1)*4}s esperando=${waiting}`);
  if (!waiting) break;
}
await snap(page, 'step27_resultado');
await browser.close();
console.log('OK');
