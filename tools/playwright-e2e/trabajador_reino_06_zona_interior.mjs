import { chromium } from 'playwright';

const SAVE_ID = 'cmthkoamc0001rixt7rl83dab';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(4000);
await page.getByRole('button', { name: /^mapa$/i }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/tr06_mapa_tab.png', fullPage: true });
// Buscar sub-tab Zona
const zonaTab = page.getByRole('button', { name: /^zona$/i });
if (await zonaTab.count() > 0) {
  await zonaTab.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/tr06_zona.png', fullPage: true });
}
const text = await page.locator('body').innerText();
console.log('body:', text.slice(0, 2000));
await browser.close();
