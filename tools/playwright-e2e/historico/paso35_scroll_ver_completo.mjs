import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(2000);
await page.getByRole('button', { name: '🗺️ Mapa' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/paso35_completo.png', fullPage: true });
await browser.close();
