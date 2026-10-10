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

await page.screenshot({ path: 'checklist0922_54_panel_multiple.png', fullPage: true });

for (let turno = 1; turno <= 5; turno++) {
  const estado = await leerEstado();
  if (!estado.combateIniciado) { console.log('Combate ya cerrado.'); break; }
  const npcs = estado.combateIniciado.npcs;
  console.log(`\n=== Turno ${turno}: NPCs = ${JSON.stringify(npcs.map(n => ({ id: n.participantId, cond: n.condicionFisica })))} ===`);

  if (npcs.every(n => n.condicionFisica === 'CONVALECIENTE' || n.condicionFisica === 'MUERTO')) {
    console.log('Todos resueltos/convalecientes, terminando ataques.');
    break;
  }

  const composer = page.locator('input[placeholder="O describe tu acción..."]');
  const disabled = await composer.isDisabled().catch(() => true);
  if (disabled) {
    for (let i = 0; i < 30 && (await composer.isDisabled().catch(() => true)); i++) await page.waitForTimeout(1000);
  }
  await composer.click();
  await composer.fill(`Ataco a Gesgurio, turno ${turno}.`);
  await page.getByRole('button', { name: /^actuar$/i }).last().click();
  console.log(`Ataque ${turno} enviado...`);

  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    const est2 = await leerEstado();
    if (!est2.combateIniciado || JSON.stringify(est2.combateIniciado.npcs) !== JSON.stringify(npcs)) {
      console.log(`[t=${i+1}s] cambio detectado.`);
      break;
    }
  }
}

await page.screenshot({ path: 'checklist0922_54_estado_final.png', fullPage: true });
console.log('Captura final tomada.');
await browser.close();
