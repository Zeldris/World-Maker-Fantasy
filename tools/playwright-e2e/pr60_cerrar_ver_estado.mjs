import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
const cerrarBtn = page.getByText('Cerrar', { exact: false }).first();
await cerrarBtn.click({ timeout: 10000 });
await page.waitForTimeout(500);
console.log(await page.locator('body').innerText());
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr60_estado_actual.png', fullPage: true });
await browser.close();
