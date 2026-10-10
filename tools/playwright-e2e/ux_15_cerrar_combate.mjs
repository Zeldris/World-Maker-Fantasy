import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
for (let i = 0; i < 10; i++) {
  const visible = await composer.isVisible().catch(() => false);
  console.log(`Intento ${i}: composer visible=${visible}`);
  if (visible) break;
  await page.waitForTimeout(4000);
}

await page.screenshot({ path: 'screenshot-ux-estado-final-combate.png', fullPage: false });

await browser.close();
