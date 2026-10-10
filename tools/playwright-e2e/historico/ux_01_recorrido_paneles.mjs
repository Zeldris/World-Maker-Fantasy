import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const panels = [
  { label: 'Inventario', emoji: '🎒' },
  { label: 'Habilidades', emoji: '✨' },
  { label: 'Compañeros', emoji: '👥' },
  { label: 'Reino', emoji: '🏰' },
  { label: 'Mapa', emoji: '🗺️' },
  { label: 'Diario', emoji: '📖' },
  { label: 'Misiones', emoji: '🎯' },
  { label: 'Reputación', emoji: '🤝' },
  { label: 'Enciclopedia', emoji: '📚' },
];

for (const { label } of panels) {
  const btn = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
  const visible = await btn.isVisible().catch(() => false);
  if (!visible) {
    console.log(`${label}: BOTÓN NO ENCONTRADO`);
    continue;
  }
  await btn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `screenshot-ux-panel-${label.toLowerCase()}.png`, fullPage: false });
  console.log(`${label}: captura tomada`);
  const cerrar = page.getByRole('button', { name: /^cerrar/i }).last();
  const cerrarVisible = await cerrar.isVisible().catch(() => false);
  console.log(`${label}: botón Cerrar visible=${cerrarVisible}`);
  if (cerrarVisible) {
    await cerrar.click();
    await page.waitForTimeout(400);
  }
}

await browser.close();
