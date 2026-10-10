import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(45000);
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const combatirBtn = page.getByRole('button', { name: /combatir/i });
if (await combatirBtn.isVisible().catch(() => false)) {
  await combatirBtn.click();
  await page.waitForTimeout(2000);
}

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);

for (let i = 0; i < 6; i++) {
  const bodyText = await page.textContent('body');
  console.log(`Iteración ${i}: MUERTO=${bodyText.includes('MUERTO')} GRAVE=${bodyText.includes('GRAVE')} CONVALECIENTE=${bodyText.includes('CONVALECIENTE')}`);

  const matarBtn = page.getByRole('button', { name: /^matar$/i });
  if (await matarBtn.isVisible().catch(() => false)) {
    console.log(`Iteración ${i}: pulsando Matar`);
    await matarBtn.click();
    await page.waitForTimeout(3000);
    continue;
  }

  if (bodyText.includes('MUERTO') || bodyText.includes('desollar') || bodyText.includes('Desollar')) {
    console.log(`Iteración ${i}: el Ruptidar parece muerto — deteniendo bucle.`);
    break;
  }

  await page.getByText('Tajo Horizontal', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(500);
  if (await actuarBtn.isDisabled().catch(() => true)) {
    console.log(`Iteración ${i}: Actuar disabled, esperando...`);
    await page.waitForTimeout(4000);
    continue;
  }
  await actuarBtn.click();
  console.log(`Iteración ${i}: atacado, esperando resolución...`);
  await page.waitForTimeout(20000);
}

await page.screenshot({ path: 'screenshot-mi-13-final.png', fullPage: false });

await browser.close();
