import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /combatir/i }).click().catch(() => {});
await page.waitForTimeout(1500);

await page.screenshot({ path: 'checklist0922_37_antes_matar.png', fullPage: true });

const matarBtn = page.getByRole('button', { name: /^matar$/i });
await matarBtn.waitFor({ state: 'visible', timeout: 10000 });
await matarBtn.click();
console.log('Pulsado MATAR, esto solo debería desbloquear el composer (según diseño: no remate garantizado).');
await page.waitForTimeout(1500);

await page.screenshot({ path: 'checklist0922_37_tras_matar_click.png', fullPage: true });

const composer = page.locator('input[placeholder="O describe tu acción..."]');
const isDisabled = await composer.isDisabled().catch(() => true);
console.log('Composer deshabilitado tras Matar?', isDisabled);

if (!isDisabled) {
  await composer.click();
  await composer.fill('Remato al Orco enfurecido con un golpe final.');
  const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
  await actuarBtn.click();
  console.log('Remate enviado, esperando resolución...');
  await page.waitForTimeout(45000);
}

await page.screenshot({ path: 'checklist0922_37_tras_remate.png', fullPage: true });
console.log('Captura final tomada.');

await browser.close();
