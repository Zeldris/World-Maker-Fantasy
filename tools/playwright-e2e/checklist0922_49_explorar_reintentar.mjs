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

for (let intento = 1; intento <= 8; intento++) {
  const explorarBtn = page.getByRole('button', { name: /explorar/i });
  await explorarBtn.click();
  await page.waitForTimeout(3000);

  const ht = await page.locator('body').innerText();
  const seccionCazar = ht.slice(ht.lastIndexOf('Cazar'));
  console.log(`--- Intento ${intento} ---`);
  console.log(seccionCazar.slice(0, 400));

  if (/confirmar|kirelon|gesgurio|nuente/i.test(seccionCazar)) {
    console.log('¡Candidato encontrado! Deteniendo bucle.');
    await page.screenshot({ path: 'checklist0922_49_candidato_encontrado.png', fullPage: true });
    break;
  }
}

await page.screenshot({ path: 'checklist0922_49_final.png', fullPage: true });
await browser.close();
