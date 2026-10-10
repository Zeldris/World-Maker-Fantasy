import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();

// Cerrar cualquier modal de enciclopedia que quedara abierto
const closeBtn = page.locator('button', { hasText: /^cerrar$/i }).first();
if ((await closeBtn.count()) > 0 && (await closeBtn.isVisible().catch(() => false))) {
  await closeBtn.click();
  await page.waitForTimeout(500);
}

const buttonsBefore = await page.getByRole('button').allInnerTexts();
console.log('¿Sigue en modo combate (COMBATIR visible)?', buttonsBefore.includes('⚔️ COMBATIR'));

// Intentar enviar una acción de texto libre normal (fuera del panel de combate) para forzar
// que el backend procese un turno normal y quizá cierre el CombatEncounter como colateral
const input = page.getByRole('textbox', { name: /acción de tu personaje/i });
const inputCount = await input.count();
console.log('input de texto libre visible:', inputCount, await input.isVisible().catch(() => 'n/a'));

if (inputCount > 0) {
  await input.click();
  await input.fill('Gorhorn respira hondo y se aparta un momento del cadáver del Kirelon Arenoso para recuperar el aliento.');
  await page.getByRole('button', { name: /^actuar$/i }).nth(0).click();
  console.log('Acción de texto libre enviada. Esperando resolución...');
  let bodyText = await page.locator('body').innerText();
  for (let i=0;i<20;i++){
    const waiting = /RESOLVIEND|NARRADOR ESCRIBE|Esperando la narración/i.test(bodyText);
    if (!waiting) break;
    await page.waitForTimeout(4000);
    bodyText = await page.locator('body').innerText();
    console.log(`t=${(i+1)*4}s esperando=${waiting}`);
  }
} else {
  console.log('NO se pudo enviar acción de texto libre: input no disponible (composer bloqueado por combateIniciado).');
}

await page.waitForTimeout(1500);
const buttonsAfter = await page.getByRole('button').allInnerTexts();
console.log('¿Sigue en modo combate TRAS intento?', buttonsAfter.includes('⚔️ COMBATIR'));
console.log('¿Aparece botón Desollar?', buttonsAfter.some(b => /desollar/i.test(b)));
await snap(page, 'step44_resultado');
await browser.close();
console.log('OK');
