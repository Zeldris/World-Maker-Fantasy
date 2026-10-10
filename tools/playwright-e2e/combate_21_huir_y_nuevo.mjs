import { chromium } from 'playwright';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);

const combatirBtn = page.getByRole('button', { name: /combatir/i });
if (await combatirBtn.count()) {
  await combatirBtn.click();
  await page.waitForTimeout(1000);
}

const huirBtn = page.getByRole('button', { name: /huir/i });
if (await huirBtn.count()) {
  console.log('Intentando huir del combate estancado...');
  await huirBtn.click();
  await page.waitForTimeout(4000);
}

await page.screenshot({ path: 'screenshots/huir_resultado.png' });
console.log('Captura tras intentar huir guardada.');
await browser.close();
