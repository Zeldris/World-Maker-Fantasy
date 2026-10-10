import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);

// Confirmar vida actual antes de atacar
let headerText = await page.locator('body').innerText();
let vidaMatch = headerText.match(/Orco enfurecido\s*\n*\s*(Herido|Ileso|Grave|Convaleciente|Muerto)\s*(\d+)/);
console.log('Vida ANTES del ataque:', vidaMatch ? `${vidaMatch[1]} ${vidaMatch[2]}` : 'NO-MATCH');
const vidaInicial = vidaMatch ? `${vidaMatch[1]} ${vidaMatch[2]}` : null;

const combatComposer = page.locator('input[placeholder="O describe tu acción..."]');
await combatComposer.click();
await combatComposer.fill('Ataco con todas mis fuerzas al Orco enfurecido, un golpe directo y contundente.');

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();

const t0 = Date.now();
await actuarBtn.click();
console.log('=== Turno enviado en t=0 ===');

let lastVida = vidaInicial;
let lastSnippet = null;

for (let i = 0; i < 200; i++) { // 60s
  await page.waitForTimeout(300);
  const elapsed = Date.now() - t0;

  const ht = await page.locator('body').innerText().catch(() => '');
  const vm = ht.match(/Orco enfurecido\s*\n*\s*(Herido|Ileso|Grave|Convaleciente|Muerto)\s*(\d+)/);
  const vida = vm ? `${vm[1]} ${vm[2]}` : 'NO-MATCH';

  let snippet = 'sin-tarjeta';
  if (/actúas primero|actúa primero/i.test(ht)) snippet = 'INICIATIVA';
  if (/resolviendo combate/i.test(ht)) snippet = 'RESOLVIENDO-INTERCAMBIO';
  if (/usas\s|se defiende con/i.test(ht)) snippet = 'NARRACION-FINAL';

  if (vida !== lastVida) {
    console.log(`[t=${elapsed}ms] *** CAMBIO VIDA RIVAL: ${lastVida} -> ${vida} ***  (tarjeta: ${snippet})`);
    lastVida = vida;
  }
  if (snippet !== lastSnippet) {
    console.log(`[t=${elapsed}ms] tarjeta -> ${snippet}  (vida: ${vida})`);
    lastSnippet = snippet;
  }

  if (vida !== vidaInicial && vida !== 'NO-MATCH' && elapsed > 2000) {
    console.log('Vida cambió respecto al inicio, deteniendo muestreo en 2s más.');
    await page.waitForTimeout(2000);
    break;
  }
}

await page.screenshot({ path: 'checklist0922_10_final.png', fullPage: true });
console.log('=== Fin ===');

await browser.close();
