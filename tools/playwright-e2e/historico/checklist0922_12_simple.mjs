import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);

const combatComposer = page.locator('input[placeholder="O describe tu acción..."]');
await combatComposer.waitFor({ state: 'visible' });
const isDisabled = await combatComposer.isDisabled();
console.log('Composer de combate deshabilitado al empezar?', isDisabled);

if (isDisabled) {
  console.log('Esperando a que se habilite (turno previo aún resolviendo)...');
  await combatComposer.waitFor({ state: 'attached' });
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    if (!(await combatComposer.isDisabled())) { console.log(`Habilitado tras ${i + 1}s`); break; }
  }
}

await combatComposer.click();
await combatComposer.fill('Ataco con todas mis fuerzas al Orco enfurecido.');
const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();

const t0 = Date.now();
await actuarBtn.click();
console.log('=== Click en ACTUAR, t=0 ===');

// Muestreo simple y robusto: leer SOLO la barra de vida (número junto a "Orco enfurecido" en el header del panel)
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1000);
  const ht = await page.locator('body').innerText().catch(() => '');
  const vm = ht.match(/Orco enfurecido\s*\n*\s*(Herido|Ileso|Grave|Convaleciente|Muerto)\s*(\d+)/);
  const resolviendo = /resolviendo combate/i.test(ht);
  const iniciativa = /actúas primero|actúa primero/i.test(ht);
  console.log(`[t=${i + 1}s] vida=${vm ? vm[1] + ' ' + vm[2] : 'NO-MATCH'}  resolviendo=${resolviendo}  iniciativa=${iniciativa}`);
}

await page.screenshot({ path: 'checklist0922_12_final.png', fullPage: true });
await browser.close();
