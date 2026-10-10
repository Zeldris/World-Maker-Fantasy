import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();

// Hacer scroll al final para localizar el chip "Kirelon Arenoso" del mensaje de "Remato a..."
const scrollable = page.locator('div', { has: page.getByText('Ver historial completo en el Diario') }).last();
await scrollable.evaluate(el => { el.scrollTop = el.scrollHeight; });
await page.waitForTimeout(500);

// Buscar todos los chips "Kirelon Arenoso" y clicar el último visible (más reciente = el cadáver actual)
const chips = page.getByRole('button', { name: /kirelon arenoso/i });
const n = await chips.count();
console.log('chips Kirelon Arenoso encontrados:', n);
await chips.last().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/step41_tras_click_cadaver.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(0, 2000));
await browser.close();
console.log('OK');
