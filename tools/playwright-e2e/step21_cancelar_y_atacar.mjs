import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
await page.locator('button', { hasText: 'Cancelar acción' }).click();
await page.waitForTimeout(2000);
await snap(page, 'step21_tras_cancelar');
await browser.close();
console.log('OK');
