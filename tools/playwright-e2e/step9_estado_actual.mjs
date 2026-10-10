import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
await snap(page, 'step9_estado_actual');
await browser.close();
console.log('OK');
