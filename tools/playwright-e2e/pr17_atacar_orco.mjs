import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Ataco al Orco Enfurecido.');
const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).first();
await actuarBtn.click();
console.log('Acción enviada, esperando resolución...');
await page.waitForTimeout(28000);
console.log(await page.locator('body').innerText());
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr17_atacar_orco.png', fullPage: true });
await browser.close();
