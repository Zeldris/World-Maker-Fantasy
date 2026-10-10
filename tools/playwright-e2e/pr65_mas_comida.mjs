import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
const opcionBtn = page.getByText('Ofrecerle más comida', { exact: false }).first();
await opcionBtn.click();
console.log('Opción pulsada, esperando...');
await page.waitForTimeout(25000);
console.log(await page.locator('body').innerText());
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr65_mas_comida.png', fullPage: true });
await browser.close();
