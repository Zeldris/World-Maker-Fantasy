import { openGame } from './play.mjs';

const { browser, page } = await openGame();
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);

// Panel derecho de combate: buscar el contenedor con "COMBATE — ATAQUE"
const combatPanel = page.locator('div', { hasText: 'COMBATE' }).last();
const html = await combatPanel.evaluate(el => el.outerHTML);
console.log(html.slice(0, 6000));
await browser.close();
console.log('OK');
