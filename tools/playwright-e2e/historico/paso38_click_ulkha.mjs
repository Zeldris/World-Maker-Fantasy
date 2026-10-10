import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
await page.getByRole('button', { name: '🗺️ Mapa' }).click();
await page.waitForTimeout(1500);

// Encontrar el <g> cuyo <title> contiene "Ulkha Ketg" y hacer click en él
const groups = page.locator('svg g');
const count = await groups.count();
for (let i = 0; i < count; i++) {
  const title = await groups.nth(i).locator('title').textContent().catch(() => '');
  if (title.includes('Ulkha Ketg')) {
    console.log('Encontrado en índice', i, ':', title);
    const box = await groups.nth(i).boundingBox();
    console.log('BBox:', JSON.stringify(box));
    await groups.nth(i).click({ force: true });
    break;
  }
}
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/paso38_modal_grupo.png', fullPage: true });
await browser.close();
