import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
// Todas las coincidencias de "Tajo Horizontal" — la última suele ser la del panel de selección real.
const tajoLocators = page.locator('text=Tajo Horizontal');
const count = await tajoLocators.count();
console.log('coincidencias de Tajo Horizontal:', count);
await tajoLocators.last().scrollIntoViewIfNeeded();
await tajoLocators.last().click();
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr30_tras_seleccionar.png', fullPage: true });
const actuarBtn = page.getByRole('button', { name: /^actuar$/i, disabled: false }).first();
await actuarBtn.click({ timeout: 10000 });
console.log('Ataque enviado, esperando...');
await page.waitForTimeout(28000);
console.log(await page.locator('body').innerText());
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr30_rematar_final.png', fullPage: true });
await browser.close();
