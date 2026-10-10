import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const modales = [
  'Volver al campamento',
  'Viajar',
  'Descansar',
  'Saquear',
  'Cazar',
  'Curar',
  'Comer/Beber',
  'Recoger',
  'Entregar',
  'Aprender oficio',
];

for (const modal of modales) {
  await page.getByRole('button', { name: /habilidades/i }).first().click();
  await page.waitForTimeout(700);
  const item = page.getByText(modal, { exact: true });
  const visible = await item.isVisible().catch(() => false);
  if (!visible) {
    console.log(`${modal}: NO ENCONTRADO en Habilidades`);
    continue;
  }
  await item.click();
  await page.waitForTimeout(1200);
  const safeLabel = modal.toLowerCase().replace(/[\/\s]+/g, '-');
  await page.screenshot({ path: `screenshot-ux-modal-${safeLabel}.png`, fullPage: false });
  console.log(`${modal}: captura tomada`);

  const dialog = page.getByRole('dialog');
  const dialogVisible = await dialog.isVisible().catch(() => false);
  console.log(`${modal}: role=dialog visible=${dialogVisible}`);

  // Cerrar el modal (Cancelar o Escape) antes del siguiente.
  const cancelar = page.getByRole('button', { name: /^cancelar$/i });
  if (await cancelar.isVisible().catch(() => false)) {
    await cancelar.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(500);
}

await browser.close();
