import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
const mapaBtn = page.getByText('Mapa', { exact: true }).first();
await mapaBtn.click();
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr08_mapa.png', fullPage: true });
console.log('screenshot listo');
await browser.close();
