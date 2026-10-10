import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();
let body = await page.locator('body').innerText();
for (let i = 0; i < 20; i++) {
  const busy = body.includes('Cancelar acción');
  console.log(`t=${i*5}s ¿ocupado en actividad?`, busy);
  if (!busy) break;
  await page.waitForTimeout(5000);
  body = await page.locator('body').innerText();
}
await snap(page, 'step24_final');
await browser.close();
console.log('OK');
