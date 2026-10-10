import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /^salir$/i }).click();
await page.waitForTimeout(2000);
await snap(page, 'step39_tras_salir');
await browser.close();
console.log('OK');
