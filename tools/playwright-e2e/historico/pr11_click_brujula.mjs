import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
const brujula = page.getByRole('button', { name: '🧭' }).first();
await brujula.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr11_zona_movimiento.png', fullPage: true });
console.log('screenshot listo');
await browser.close();
