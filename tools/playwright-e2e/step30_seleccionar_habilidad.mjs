import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);

// Primero comprobar si el enemigo Kirelon Arenoso ya está seleccionado; si hay varios enemigos,
// hacer click en su tarjeta. En este caso solo hay un Kirelon Arenoso.
const enemyCard = page.getByText('Kirelon Arenoso', { exact: true }).first();
await enemyCard.click();
await page.waitForTimeout(500);

// Ahora seleccionar la habilidad "Ataque Básico" (div role=button)
const abilityCard = page.getByRole('button', { name: /ataque básico/i }).first();
const count = await abilityCard.count();
console.log('ataque basico count (role=button):', count);
if (count === 0) {
  // Puede que el role sea distinto; buscar por texto directamente
  const alt = page.locator('div[role="button"]', { hasText: 'Ataque Básico' });
  console.log('alt count:', await alt.count());
  await alt.first().click();
} else {
  await abilityCard.click();
}
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/step30_seleccionado.png', fullPage: true });

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
console.log('actuar disabled tras seleccionar:', await actuarBtn.isDisabled());
await browser.close();
console.log('OK');
