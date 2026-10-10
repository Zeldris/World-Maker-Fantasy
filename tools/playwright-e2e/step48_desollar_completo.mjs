import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
await page.waitForTimeout(1500);

await page.getByRole('button', { name: /presas caídas sin desollar/i }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/step48_modal_desollar.png', fullPage: true });

const bodyText = await page.locator('body').innerText();
console.log('=== modal abierto ===');
console.log(bodyText.slice(0, 2000));

await browser.close();
console.log('OK');
