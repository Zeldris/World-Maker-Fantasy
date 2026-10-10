import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(45000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const ignorarBtn = page.getByText('Ignorar a Gesgurio y continuar explorando la hondonada', { exact: true });
if (await ignorarBtn.isVisible().catch(() => false)) {
  await ignorarBtn.click();
  console.log('Ignorar pulsado, cerrando el mini-flujo...');
  await page.waitForTimeout(25000);
}

await page.screenshot({ path: 'screenshot-ux-dinamico-cerrado.png', fullPage: false });

await browser.close();
