import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const habilidadesBtn = page.locator('button', { hasText: 'Habilidades' }).first();
await habilidadesBtn.click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /cazar/i }).click();
await page.waitForTimeout(1000);

// Reintentar Explorar hasta ver Gesgurio de nuevo (el estado no persiste entre cargas de página)
let encontrado = false;
for (let i = 0; i < 10 && !encontrado; i++) {
  await page.getByRole('button', { name: /explorar/i }).click();
  await page.waitForTimeout(3000);
  const ht = await page.locator('body').innerText();
  if (/gesgurio/i.test(ht.slice(ht.lastIndexOf('Cazar')))) encontrado = true;
}
console.log('Gesgurio encontrado en este ciclo?', encontrado);

if (encontrado) {
  // Seleccionar la fila del candidato (checkbox o click en el nombre) y confirmar
  await page.getByText(/gesgurio/i).first().click().catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'checklist0922_50_antes_confirmar.png', fullPage: true });

  const cazarConfirmBtn = page.getByRole('button', { name: /^cazar$/i });
  await cazarConfirmBtn.click();
  console.log('Confirmada la caza del grupo, esperando resolución...');
  await page.waitForTimeout(30000);
}

await page.screenshot({ path: 'checklist0922_50_resultado.png', fullPage: true });
await browser.close();
