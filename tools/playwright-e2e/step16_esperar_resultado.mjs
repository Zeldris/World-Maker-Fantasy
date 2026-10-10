import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
let bodyText = await page.locator('body').innerText();
for (let i=0;i<15;i++){
  if (!bodyText.includes('NARRADOR ESCRIBE') && !bodyText.includes('Esperando la narración')) break;
  await page.waitForTimeout(4000);
  bodyText = await page.locator('body').innerText();
  console.log(`t=${(i+1)*4}s aún esperando:`, bodyText.includes('NARRADOR ESCRIBE') || bodyText.includes('Esperando la narración'));
}
await snap(page, 'step16_resultado');
await browser.close();
console.log('OK');
