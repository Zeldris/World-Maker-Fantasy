import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
const salirBtn = page.getByRole('button', { name: /^salir$/i }).first();
await salirBtn.click();
await page.waitForTimeout(2000);
console.log(await page.locator('body').innerText());
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr39_tras_salir.png', fullPage: true });
await browser.close();
