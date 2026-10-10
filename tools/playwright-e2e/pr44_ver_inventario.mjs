import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
const escBtn = page.keyboard;
await escBtn.press('Escape').catch(() => {});
await page.waitForTimeout(500);
const invBtn = page.locator('text=Inventario').first();
await invBtn.click({ timeout: 10000 });
await page.waitForTimeout(1500);
console.log(await page.locator('body').innerText());
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr44_inventario.png', fullPage: true });
await browser.close();
