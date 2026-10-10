import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
const scrollable = page.locator('div', { has: page.getByText('Ver historial completo en el Diario') }).last();
await scrollable.evaluate(el => { el.scrollTop = el.scrollHeight; });
await page.waitForTimeout(300);

const chips = page.getByRole('button', { name: /kirelon arenoso/i });
await chips.last().click();
await page.waitForTimeout(1000);

// Cerrar el modal (buscar botón X o click fuera)
const closeBtn = page.locator('button', { hasText: '✕' }).first();
if ((await closeBtn.count()) > 0) {
  await closeBtn.click();
} else {
  await page.keyboard.press('Escape');
}
await page.waitForTimeout(500);

// Comprobar si en el panel derecho "COMBATIR/HUIR/ACTUAR" hay opción de saqueo/interacción con cadáver
// Revisar todos los botones actuales
const buttons = await page.getByRole('button').allInnerTexts();
console.log('BOTONES TRAS CERRAR MODAL:', JSON.stringify(buttons.filter(b => /saque|desoll|cadáver|cuerpo|restos|interactuar/i.test(b))));
console.log('TODOS:', JSON.stringify(buttons));

await page.screenshot({ path: 'screenshots/step42_estado.png', fullPage: true });
await browser.close();
console.log('OK');
