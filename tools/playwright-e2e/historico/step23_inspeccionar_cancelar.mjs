import { openGame } from './play.mjs';

const { browser, page } = await openGame();
const btn = page.locator('button', { hasText: 'Cancelar acción' });
console.log('count:', await btn.count());
for (let i = 0; i < await btn.count(); i++) {
  const b = btn.nth(i);
  console.log(`btn[${i}] visible=${await b.isVisible()} enabled=${await b.isEnabled()}`);
  console.log(await b.evaluate(el => el.outerHTML.slice(0, 300)));
}
await page.screenshot({ path: 'screenshots/step23_before.png', fullPage: true });
await btn.first().click({ force: true });
let body = '';
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(2000);
  body = await page.locator('body').innerText();
  const still = body.includes('Cancelar acción');
  console.log(`t=${(i+1)*2}s ¿sigue Cancelar acción?`, still);
  if (!still) break;
}
await page.screenshot({ path: 'screenshots/step23_after.png', fullPage: true });
await browser.close();
console.log('OK');
