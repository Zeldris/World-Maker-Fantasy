import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(45000);
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
page.on('response', (res) => {
  if (res.status() >= 400 && !res.url().includes('/resume')) console.log('[response error]', res.status(), res.url());
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const combatirBtn = page.getByRole('button', { name: /combatir/i });
if (await combatirBtn.isVisible().catch(() => false)) {
  await combatirBtn.click();
  await page.waitForTimeout(2000);
}

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
console.log('Actuar enabled ahora:', !(await actuarBtn.isDisabled()));

// Repite el ataque hasta 5 veces (fauna sencilla, el Ruptidar debería caer pronto).
for (let i = 0; i < 5; i++) {
  await page.getByText('Tajo Horizontal', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(500);
  const isEnabled = !(await actuarBtn.isDisabled().catch(() => true));
  if (!isEnabled) {
    console.log(`Ronda ${i}: Actuar sigue disabled tras seleccionar la habilidad, esperando...`);
    await page.waitForTimeout(4000);
    continue;
  }
  await actuarBtn.click();
  console.log(`Ronda ${i}: atacado, esperando resolución...`);
  await page.waitForTimeout(20000);

  const bodyText = await page.textContent('body');
  if (bodyText.includes('MUERTO') || bodyText.includes('CONVALECIENTE') || bodyText.includes('MATAR') || bodyText.includes('CLEMENTE')) {
    console.log(`Ronda ${i}: parece que el Ruptidar cayó — deteniendo el bucle.`);
    break;
  }
}

await page.screenshot({ path: 'screenshot-mi-10-combate-avanzado.png', fullPage: false });

await browser.close();
