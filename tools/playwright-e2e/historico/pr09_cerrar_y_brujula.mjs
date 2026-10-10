import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
const cerrarBtn = page.getByText('Cerrar', { exact: false }).first();
await cerrarBtn.click();
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr09_tras_cerrar.png', fullPage: true });
console.log(await page.locator('body').innerText());
await browser.close();
