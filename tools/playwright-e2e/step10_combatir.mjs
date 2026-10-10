import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);
await snap(page, 'step10_combatir');
await browser.close();
console.log('OK');
