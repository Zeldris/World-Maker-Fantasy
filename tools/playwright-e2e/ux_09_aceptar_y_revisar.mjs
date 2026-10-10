import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const aceptar = page.getByRole('button', { name: /aceptar/i });
if (await aceptar.isVisible().catch(() => false)) {
  await aceptar.click();
  await page.waitForTimeout(3000);
}

await page.screenshot({ path: 'screenshot-ux-tras-aceptar-muerte2.png', fullPage: false });

await browser.close();
