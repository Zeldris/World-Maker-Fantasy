import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
await page.reload();
await page.waitForTimeout(2500);
await snap(page, 'step40_recargado');
const buttons = await page.getByRole('button').allInnerTexts();
console.log('BOTONES:', JSON.stringify(buttons));
await browser.close();
console.log('OK');
