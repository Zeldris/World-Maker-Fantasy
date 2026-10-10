import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
for (let i = 0; i < 12; i++) {
  const disabled = await composer.getAttribute('aria-disabled');
  console.log(`Intento ${i}: composer aria-disabled=${disabled}`);
  if (disabled !== 'true') break;
  await page.waitForTimeout(5000);
}

await page.screenshot({ path: 'screenshot-mi-21-final.png', fullPage: false });

await browser.close();
