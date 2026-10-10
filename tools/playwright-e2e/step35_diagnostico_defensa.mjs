import { openGame } from './play.mjs';

const { browser, page } = await openGame();
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);

const buttons = await page.getByRole('button').allInnerTexts();
console.log('BOTONES ROLE=BUTTON:', JSON.stringify(buttons, null, 1));

await page.screenshot({ path: 'screenshots/step35_diagnostico.png', fullPage: true });
await browser.close();
console.log('OK');
