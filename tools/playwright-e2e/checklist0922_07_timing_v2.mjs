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
await combatComposer.fill('Ataco con un golpe directo, con el arma que llevo en la mano principal, contra el Orco enfurecido.');

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
await actuarBtn.click();

const t0 = Date.now();
console.log('=== Turno enviado en t=0 ===');

let lastVida = null;
let lastDiceVisible = null;
let lastThinking = null;

for (let i = 0; i < 100; i++) { // hasta 30s (100 x 300ms)
  await page.waitForTimeout(300);
  const elapsed = Date.now() - t0;

  const headerText = await page.locator('body').innerText().catch(() => '');
  const vidaMatch = headerText.match(/Orco enfurecido\s*\n*\s*(Herido|Ileso|Grave|Convaleciente|Muerto)\s*(\d+)/);
  const vida = vidaMatch ? `${vidaMatch[1]} ${vidaMatch[2]}` : 'NO-MATCH';

  // Heurística de animación de dados: busca patrones de tirada (🎲, "vs", "+", "=") en zona activa
  const diceVisible = /🎲/.test(headerText);
  const thinking = /pensando|tirando la iniciativa|actúas primero|actúa primero/i.test(headerText);

  if (vida !== lastVida) {
    console.log(`[t=${elapsed}ms] CAMBIO VIDA RIVAL -> ${vida}`);
    lastVida = vida;
  }
  if (diceVisible !== lastDiceVisible) {
    console.log(`[t=${elapsed}ms] dados visibles (🎲 en pantalla) -> ${diceVisible}`);
    lastDiceVisible = diceVisible;
  }
  if (thinking !== lastThinking) {
    console.log(`[t=${elapsed}ms] texto iniciativa/pensando -> ${thinking}`);
    lastThinking = thinking;
  }
}

await page.screenshot({ path: 'checklist0922_07_final.png', fullPage: true });
console.log('=== Fin de muestreo ===');

await browser.close();
