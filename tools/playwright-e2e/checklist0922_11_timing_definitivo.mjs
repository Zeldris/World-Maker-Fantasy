import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);

async function leerVida() {
  const ht = await page.locator('body').innerText().catch(() => '');
  const vm = ht.match(/Orco enfurecido\s*\n*\s*(Herido|Ileso|Grave|Convaleciente|Muerto)\s*(\d+)/);
  return vm ? `${vm[1]} ${vm[2]}` : 'NO-MATCH';
}

for (let intento = 1; intento <= 4; intento++) {
  const vidaAntes = await leerVida();
  console.log(`\n--- Intento ${intento}: vida ANTES = ${vidaAntes} ---`);

  const combatComposer = page.locator('input[placeholder="O describe tu acción..."]');
  await combatComposer.click();
  await combatComposer.fill(`Ataco con fuerza al Orco enfurecido, intento número ${intento}.`);
  const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();

  const t0 = Date.now();
  await actuarBtn.click();

  let lastVida = vidaAntes;
  let vidaCambioEn = null;
  let resolviendoVistoEn = null;

  for (let i = 0; i < 130; i++) { // hasta 39s
    await page.waitForTimeout(300);
    const elapsed = Date.now() - t0;
    const ht = await page.locator('body').innerText().catch(() => '');
    const vida = (ht.match(/Orco enfurecido\s*\n*\s*(Herido|Ileso|Grave|Convaleciente|Muerto)\s*(\d+)/) || [])[0]
      ? `${ht.match(/Orco enfurecido\s*\n*\s*(Herido|Ileso|Grave|Convaleciente|Muerto)\s*(\d+)/)[1]} ${ht.match(/Orco enfurecido\s*\n*\s*(Herido|Ileso|Grave|Convaleciente|Muerto)\s*(\d+)/)[2]}`
      : 'NO-MATCH';
    const resolviendo = /resolviendo combate/i.test(ht);

    if (resolviendo && resolviendoVistoEn === null) {
      resolviendoVistoEn = elapsed;
      console.log(`  [t=${elapsed}ms] tarjeta "RESOLVIENDO COMBATE" aparece`);
    }
    if (vida !== lastVida && vidaCambioEn === null) {
      vidaCambioEn = elapsed;
      console.log(`  [t=${elapsed}ms] *** VIDA CAMBIA: ${lastVida} -> ${vida} ***`);
      lastVida = vida;
    }
    if (!resolviendo && resolviendoVistoEn !== null && i > 3 && elapsed - resolviendoVistoEn > 1500) {
      // La tarjeta de resolviendo ya desapareció (sustituida por narración final) hace tiempo -> turno terminado
      console.log(`  [t=${elapsed}ms] tarjeta "resolviendo" ya no visible, turno probablemente cerrado`);
      break;
    }
  }

  const vidaFinal = await leerVida();
  console.log(`--- Intento ${intento} resultado: vida ANTES=${vidaAntes}  DESPUES=${vidaFinal}  cambioEn=${vidaCambioEn}ms  resolviendoVistoEn=${resolviendoVistoEn}ms ---`);

  if (vidaFinal !== vidaAntes) {
    console.log('IMPACTO CONFIRMADO — terminando la ronda de intentos.');
    await page.screenshot({ path: 'checklist0922_11_impacto.png', fullPage: true });
    break;
  }
  await page.waitForTimeout(1500);
}

await browser.close();
