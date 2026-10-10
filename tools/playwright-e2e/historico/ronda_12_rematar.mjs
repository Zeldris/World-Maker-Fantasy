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

await page.screenshot({ path: 'screenshot-mi-12-antes.png', fullPage: false });

const bodyText0 = await page.textContent('body');
console.log('Estado GRAVE presente:', bodyText0.includes('GRAVE'));
console.log('Menciona MATAR/CLEMENTE:', bodyText0.includes('MATAR') || bodyText0.includes('CLEMENTE'));

// Si ya está GRAVE/CONVALECIENTE, probar Matar/Clemente; si no, seguir atacando.
const matarBtn = page.getByRole('button', { name: /^matar$/i });
if (await matarBtn.isVisible().catch(() => false)) {
  console.log('Botón Matar visible — pulsando.');
  await matarBtn.click();
  await page.waitForTimeout(3000);
} else {
  const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).nth(0);
  for (let i = 0; i < 3; i++) {
    await page.getByText('Tajo Horizontal', { exact: true }).click().catch(() => {});
    await page.waitForTimeout(500);
    if (await actuarBtn.isDisabled().catch(() => true)) {
      await page.waitForTimeout(4000);
      continue;
    }
    await actuarBtn.click();
    console.log(`Ataque extra ${i} enviado, esperando...`);
    await page.waitForTimeout(20000);
    const bt = await page.textContent('body');
    if (bt.includes('MATAR') || bt.includes('CLEMENTE') || bt.includes('MUERTO')) {
      console.log('Llegó a desenlace final.');
      break;
    }
  }
}

await page.screenshot({ path: 'screenshot-mi-12-despues.png', fullPage: false });

await browser.close();
