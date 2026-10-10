import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
const compBtn = page.getByText('Compañeros', { exact: false }).first();
await compBtn.click();
await page.waitForTimeout(2000);
console.log(await page.locator('body').innerText());
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr41_companeros.png', fullPage: true });
await browser.close();
