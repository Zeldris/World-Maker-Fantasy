import { getPage } from './_conn.mjs';

const { browser, page } = await getPage();
const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Espero a que la orca del Clan Serhu llegue y le hablo.');
const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).first();
await actuarBtn.click();
console.log('Acción enviada, esperando...');
await page.waitForTimeout(30000);
console.log(await page.locator('body').innerText());
await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr58_hablar_orca.png', fullPage: true });
await browser.close();
