import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);

const t0 = Date.now();
console.log('=== Empezando a observar el turno YA en curso (iniciativa disparada) ===');

let lastVida = null;
let lastSnippet = null;

for (let i = 0; i < 200; i++) { // 60s
  await page.waitForTimeout(300);
  const elapsed = Date.now() - t0;

  const headerText = await page.locator('body').innerText().catch(() => '');
  const vidaMatch = headerText.match(/Orco enfurecido\s*\n*\s*(Herido|Ileso|Grave|Convaleciente|Muerto)\s*(\d+)/);
  const vida = vidaMatch ? `${vidaMatch[1]} ${vidaMatch[2]}` : 'NO-MATCH';

  // Capturar qué tarjeta está activa ahora mismo: "Actúas primero" / "RESOLVIENDO COMBATE" / tirada del intercambio
  let snippet = 'ninguna-tarjeta-reconocida';
  if (/actúas primero|actúa primero/i.test(headerText)) snippet = 'INICIATIVA';
  if (/resolviendo combate/i.test(headerText)) snippet = 'RESOLVIENDO-INTERCAMBIO';
  if (/usas\s|se defiende con/i.test(headerText)) snippet = 'NARRACION-FINAL';

  if (vida !== lastVida) {
    console.log(`[t=${elapsed}ms] CAMBIO VIDA RIVAL -> ${vida}  (tarjeta actual: ${snippet})`);
    lastVida = vida;
  }
  if (snippet !== lastSnippet) {
    console.log(`[t=${elapsed}ms] tarjeta cambia a -> ${snippet}  (vida actual: ${vida})`);
    lastSnippet = snippet;
  }
}

await page.screenshot({ path: 'checklist0922_09_final.png', fullPage: true });
console.log('=== Fin de muestreo (60s) ===');

await browser.close();
