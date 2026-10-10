import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1500);

// Usar el composer DENTRO de combate (input real, no contentEditable)
const combatComposer = page.locator('input[placeholder="O describe tu acción..."]');
await combatComposer.click();
await combatComposer.fill('Ataco con un golpe directo, con el arma que llevo en la mano principal, contra el Orco enfurecido.');

const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
await actuarBtn.click();

const t0 = Date.now();
console.log('Turno de combate enviado en t=0, empezando a muestrear la barra de vida del rival cada 500ms...');

const vidaBarLocator = page.locator('text=Orco enfurecido').first().locator('xpath=ancestor::*[contains(@class,"combat") or self::div][1]');

let lastReading = null;
for (let i = 0; i < 60; i++) { // hasta 30s
  await page.waitForTimeout(500);
  const elapsed = Date.now() - t0;
  // Leer el texto del panel de combate completo (header con % de vida del rival)
  const headerText = await page.locator('body').innerText().catch(() => '');
  const match = headerText.match(/Orco enfurecido\s+(Herido|Ileso|Grave|Convaleciente|Muerto)\s*(\d+)/);
  const reading = match ? `${match[1]} ${match[2]}` : 'NO-MATCH';
  if (reading !== lastReading) {
    console.log(`t=${elapsed}ms  barra rival = ${reading}`);
    lastReading = reading;
  }
  // También detectar si sigue habiendo animación de dados visible (texto "Tirando" o similar)
  const thinking = /pensando|tirando|iniciativa/i.test(headerText);
  if (i % 4 === 0) console.log(`  (t=${elapsed}ms) thinking/animando=${thinking}`);
}

await page.screenshot({ path: 'checklist0922_04_final.png', fullPage: true });
console.log('--- Fin de muestreo ---');

await browser.close();
