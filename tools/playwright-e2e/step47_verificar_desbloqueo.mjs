import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/step47_estado_tras_fix.png', fullPage: true });

const input = page.getByRole('textbox', { name: /acción de tu personaje/i });
console.log('input aria-disabled:', await input.getAttribute('aria-disabled'));

const buttons = await page.getByRole('button').allInnerTexts();
console.log('Tiene COMBATIR:', buttons.some(b => /combatir/i.test(b)));
console.log('Tiene Desollar (aviso pasivo):', buttons.some(b => /desollar|presas caídas/i.test(b)));
console.log('Todos los botones visibles:', JSON.stringify(buttons));

await browser.close();
console.log('OK');
