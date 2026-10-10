import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
const interactuarBtn = page.getByRole('button', { name: /^interactuar$/i }).first();
await interactuarBtn.click();
console.log('Interactuar pulsado, esperando...');
await page.waitForTimeout(15000);
console.log(await page.locator('body').innerText());
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr63_interactuar.png', fullPage: true });
await browser.close();
