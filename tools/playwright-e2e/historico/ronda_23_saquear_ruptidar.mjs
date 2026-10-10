import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const saquearBtn = page.getByRole('button', { name: /saquear/i });
if (await saquearBtn.isVisible().catch(() => false)) {
  await saquearBtn.click();
  await page.waitForTimeout(2000);
}

await page.screenshot({ path: 'screenshot-mi-23-saqueado.png', fullPage: false });

await browser.close();
