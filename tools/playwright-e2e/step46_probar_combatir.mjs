import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
await snap(page, 'step46_estado_inicial');

const combatirBtn = page.getByRole('button', { name: /combatir/i });
const hasCombatir = await combatirBtn.count();
console.log('boton Combatir presente:', hasCombatir);

if (hasCombatir > 0) {
  await combatirBtn.click();
  await page.waitForTimeout(1500);
  await snap(page, 'step46_tras_pulsar_combatir');
}

await browser.close();
console.log('OK');
