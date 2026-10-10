import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

async function leerEstado() {
  const res = await fetch(`http://localhost:3001/saves/${SAVE_ID}`);
  return res.json();
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /combatir/i }).click().catch(() => {});
await page.waitForTimeout(1500);

await page.screenshot({ path: 'checklist0922_90_panel_inicial.png', fullPage: true });

for (let turno = 1; turno <= 4; turno++) {
  const estado = await leerEstado();
  if (!estado.combateIniciado) { console.log('Combate cerrado.'); break; }
  const npcs = estado.combateIniciado.npcs;
  console.log(`\n=== Turno ${turno}: ${JSON.stringify(npcs.map(n => n.condicionFisica))} ===`);
  if (npcs.some(n => n.condicionFisica === 'CONVALECIENTE')) {
    console.log('Al menos uno Convaleciente, terminando ataques.');
    break;
  }

  const composer = page.locator('input[placeholder="O describe tu acción..."]');
  const disabled = await composer.isDisabled().catch(() => true);
  if (disabled) {
    for (let i = 0; i < 40 && (await composer.isDisabled().catch(() => true)); i++) await page.waitForTimeout(1000);
  }
  await composer.click();
  await composer.fill(`Ataco a Gesgurio, turno ${turno}.`);
  await page.getByRole('button', { name: /^actuar$/i }).last().click();
  console.log(`Ataque ${turno} enviado...`);

  const npcsAntes = JSON.stringify(npcs);
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    const est2 = await leerEstado();
    if (!est2.combateIniciado || JSON.stringify(est2.combateIniciado.npcs) !== npcsAntes) {
      console.log(`[t=${i+1}s] cambio detectado.`);
      break;
    }
  }
}

const estadoFinal = await leerEstado();
console.log('\nEstado final:', JSON.stringify(estadoFinal.combateIniciado));
await page.screenshot({ path: 'checklist0922_90_estado_final.png', fullPage: true });
await browser.close();
