import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/step26_combate.png', fullPage: true });
await browser.close();
console.log('OK');
