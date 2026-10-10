import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1500);

const combatComposer = page.locator('input[placeholder="O describe tu acción..."]');
await combatComposer.click();
await combatComposer.fill('Ataco de nuevo con un golpe directo contra el Orco enfurecido.');

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
await actuarBtn.click();

const t0 = Date.now();
console.log('=== Turno enviado en t=0 ===');

let lastVida = null;
let lastResolviendo = null;
let lastIniciativa = null;

for (let i = 0; i < 200; i++) { // hasta 60s
  await page.waitForTimeout(300);
  const elapsed = Date.now() - t0;

  const headerText = await page.locator('body').innerText().catch(() => '');
  const vidaMatch = headerText.match(/Orco enfurecido\s*\n*\s*(Herido|Ileso|Grave|Convaleciente|Muerto)\s*(\d+)/);
  const vida = vidaMatch ? `${vidaMatch[1]} ${vidaMatch[2]}` : 'NO-MATCH';
  const resolviendo = /resolviendo combate/i.test(headerText);
  const iniciativa = /tirando.{0,20}iniciativa|actúas primero|actúa primero/i.test(headerText);

  if (vida !== lastVida) {
    console.log(`[t=${elapsed}ms] CAMBIO VIDA RIVAL -> ${vida}`);
    lastVida = vida;
  }
  if (resolviendo !== lastResolviendo) {
    console.log(`[t=${elapsed}ms] "RESOLVIENDO COMBATE" visible -> ${resolviendo}`);
    lastResolviendo = resolviendo;
  }
  if (iniciativa !== lastIniciativa) {
    console.log(`[t=${elapsed}ms] texto iniciativa -> ${iniciativa}`);
    lastIniciativa = iniciativa;
  }

  if (vida !== 'NO-MATCH' && vida !== 'Herido 75' && i > 3) {
    console.log('Vida cambió, esperando 3s más y terminando.');
    await page.waitForTimeout(3000);
    break;
  }
}

await page.screenshot({ path: 'checklist0922_08_final.png', fullPage: true });
console.log('=== Fin de muestreo ===');

await browser.close();
