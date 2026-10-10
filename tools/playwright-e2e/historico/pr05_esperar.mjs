import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
await page.waitForTimeout(15000);
console.log(await page.locator('body').innerText());
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr05_estado.png', fullPage: true });
await browser.close();
