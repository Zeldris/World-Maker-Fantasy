import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
const defenderseBtn = page.getByText('Defenderse', { exact: true }).first();
await defenderseBtn.click();
await page.waitForTimeout(1000);
const confirmBtn = page.getByText('DEFENDERTE', { exact: false }).first();
await confirmBtn.click();
console.log('Defensa enviada, esperando resolución...');
await page.waitForTimeout(25000);
console.log(await page.locator('body').innerText());
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr19_defensa_resuelta.png', fullPage: true });
await browser.close();
