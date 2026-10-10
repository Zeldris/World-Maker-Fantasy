import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);

const abilityCard = page.getByRole('button', { name: /ataque básico/i }).first();
await abilityCard.click();
await page.waitForTimeout(500);

// El botón ACTUAR correcto: dentro del panel de combate, azul, grande, ancho completo
// Buscar por posición: el que NO está deshabilitado
const actuarBtns = page.getByRole('button', { name: /^actuar$/i });
const n = await actuarBtns.count();
console.log('n actuar btns:', n);
for (let i=0;i<n;i++){
  const b = actuarBtns.nth(i);
  console.log(`btn[${i}] disabled=`, await b.isDisabled());
}

// Click en el primero que esté habilitado
let clicked = false;
for (let i=0;i<n;i++){
  const b = actuarBtns.nth(i);
  if (!(await b.isDisabled())) {
    await b.click();
    clicked = true;
    console.log('clicked btn', i);
    break;
  }
}
if (!clicked) console.log('NINGUN boton actuar habilitado');

console.log('Esperando resolución...');
let bodyText = await page.locator('body').innerText();
for (let i=0;i<20;i++){
  await page.waitForTimeout(4000);
  bodyText = await page.locator('body').innerText();
  const waiting = bodyText.includes('NARRADOR ESCRIBE') || bodyText.includes('Esperando la narración');
  console.log(`t=${(i+1)*4}s esperando=${waiting}`);
  if (!waiting) break;
}
await snap(page, 'step32_resultado');
await browser.close();
console.log('OK');
