import { openGame } from './play.mjs';

const { browser, page } = await openGame();
// El panel "TU PERSONAJE" es scrollable; buscar el contenedor y hacer scroll al final
const panel = page.locator('text=TU PERSONAJE').locator('xpath=ancestor::div[contains(@class,"plank-panel") or self::div][1]').first();
// Más simple: usar el contenedor con overflow-y visible cerca del texto "Ver historial completo"
const scrollable = page.locator('div', { has: page.getByText('Ver historial completo en el Diario') }).last();
await scrollable.evaluate(el => { el.scrollTop = el.scrollHeight; });
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/step17_scrolled.png', fullPage: true });
const text = await page.locator('body').innerText();
console.log(text.slice(text.indexOf('TU ACCIÓN'), text.indexOf('TU ACCIÓN') + 2000));
await browser.close();
console.log('OK');
