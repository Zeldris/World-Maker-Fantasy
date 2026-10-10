import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
let bodyText = await page.locator('body').innerText();
for (let i=0;i<20;i++){
  const waiting = /RESOLVIEND|NARRADOR ESCRIBE|Esperando la narración/i.test(bodyText);
  console.log(`t=${i*4}s esperando=${waiting}`);
  if (!waiting) break;
  await page.waitForTimeout(4000);
  bodyText = await page.locator('body').innerText();
}
await snap(page, 'step33_final');
await browser.close();
console.log('OK');
