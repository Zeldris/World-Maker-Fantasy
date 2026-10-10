import { openGame } from './play.mjs';

const { browser, page } = await openGame();
const scrollable = page.locator('div', { has: page.getByText('Ver historial completo en el Diario') }).last();
await scrollable.evaluate(el => { el.scrollTop = el.scrollHeight; });
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/step34_scrolled.png', fullPage: true });
const text = await page.locator('body').innerText();
const idx = text.lastIndexOf('TU ACCIÓN');
console.log(text.slice(Math.max(0, idx - 100)));
await browser.close();
console.log('OK');
