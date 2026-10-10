import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
await page.getByRole('button', { name: '🗺️ Mapa' }).click();
await page.waitForTimeout(1500);
const groups = page.locator('svg g');
const count = await groups.count();
for (let i = 0; i < count; i++) {
  const title = await groups.nth(i).locator('title').textContent().catch(() => '');
  if (title.includes('Ulkha Ketg')) {
    await groups.nth(i).click({ force: true });
    break;
  }
}
await page.waitForTimeout(800);
const links = await page.getByText('Ver en la Enciclopedia').all();
await links[1].click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/paso39_enciclopedia_gogorath.png', fullPage: true });
await browser.close();
