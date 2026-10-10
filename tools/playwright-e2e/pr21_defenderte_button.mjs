import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
const btn = page.getByRole('button', { name: /defenderte/i }).first();
const isDisabled = await btn.isDisabled().catch(() => null);
console.log('disabled?', isDisabled);
const box = await btn.boundingBox();
console.log('box:', JSON.stringify(box));
await btn.click({ force: false });
console.log('click hecho, esperando...');
await page.waitForTimeout(28000);
console.log(await page.locator('body').innerText());
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr21_tras_click_real.png', fullPage: true });
await browser.close();
