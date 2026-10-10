import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
await snap(page, 'step36_estado');
await browser.close();
console.log('OK');
