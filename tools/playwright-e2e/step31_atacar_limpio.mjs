import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);

// NO hacer click en la tarjeta del enemigo (abre un modal de ficha). Solo hay un Kirelon Arenoso,
// probablemente ya preseleccionado. Ir directo a seleccionar la habilidad "Ataque Básico".
const abilityCard = page.getByRole('button', { name: /ataque básico/i }).first();
await abilityCard.click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/step31_seleccionado.png', fullPage: true });

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
const disabled = await actuarBtn.isDisabled();
console.log('actuar disabled tras seleccionar habilidad:', disabled);

if (!disabled) {
  await actuarBtn.click();
  console.log('Click en Actuar enviado. Esperando resolución...');
  let bodyText = await page.locator('body').innerText();
  for (let i=0;i<15;i++){
    await page.waitForTimeout(4000);
    bodyText = await page.locator('body').innerText();
    const waiting = bodyText.includes('NARRADOR ESCRIBE') || bodyText.includes('Esperando la narración');
    console.log(`t=${(i+1)*4}s esperando=${waiting}`);
    if (!waiting) break;
  }
}
await snap(page, 'step31_resultado');
await browser.close();
console.log('OK');
