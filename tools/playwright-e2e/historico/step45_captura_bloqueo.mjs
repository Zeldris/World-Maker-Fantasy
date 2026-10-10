import { openGame } from './play.mjs';

const { browser, page } = await openGame();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/step45_bloqueo_combate_zombie.png', fullPage: true });
const input = page.getByRole('textbox', { name: /acción de tu personaje/i });
console.log('input aria-disabled:', await input.getAttribute('aria-disabled'));
const buttons = await page.getByRole('button').allInnerTexts();
console.log('Tiene COMBATIR:', buttons.includes('⚔️ COMBATIR'));
console.log('Tiene HUIR:', buttons.some(b => /huir/i.test(b)));
console.log('Tiene ACTUAR habilitado (footer):', buttons.includes('ACTUAR'));
await browser.close();
console.log('OK');
