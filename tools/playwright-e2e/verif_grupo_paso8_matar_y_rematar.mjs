import { chromium } from 'playwright';

const SAVE_ID = 'cmtmlfk420025ri85hnrpxy66';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(45000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

const combatirBtn = page.getByRole('button', { name: /^⚔️ combatir$/i });
if (await combatirBtn.count()) {
  await combatirBtn.first().click();
  await page.waitForTimeout(1200);
}

// Pulsar Matar en TODAS las tarjetas convalecientes visibles ahora, en la misma sesión
const matarButtons = await page.getByRole('button', { name: /^matar$/i }).all();
console.log(`Tarjetas Matar al empezar: ${matarButtons.length}`);
for (let i = 0; i < matarButtons.length; i++) {
  const btns = await page.getByRole('button', { name: /^matar$/i }).all();
  if (btns.length === 0) break;
  await btns[0].click();
  console.log(`  Matar #${i + 1} pulsado`);
  await page.waitForTimeout(500);
}
await page.screenshot({ path: 'screenshots/verif_grupo_f_tras_matar_todos.png', fullPage: true });

// Ahora el composer debería estar desbloqueado — atacar en bucle para rematar de verdad
for (let i = 1; i <= 20; i++) {
  const composer = page.getByRole('textbox');
  const composerReady = await composer.isEnabled().catch(() => false);
  if (!composerReady) {
    console.log(`[${i}] composer deshabilitado, esperando 3s...`);
    await page.waitForTimeout(3000);
    continue;
  }
  const enemigosVivos = await page.locator('text=/Zense Ceniza #\\d/').count();
  if (enemigosVivos === 0) {
    console.log(`[${i}] Sin tarjetas de enemigo — combate resuelto.`);
    break;
  }
  await composer.click();
  await composer.fill('Remato con todas mis fuerzas al rival que tengo delante.');
  await page.waitForTimeout(300);
  const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
  const actuarEnabled = await actuarBtn.isEnabled().catch(() => false);
  if (!actuarEnabled) {
    console.log(`[${i}] Actuar deshabilitado, esperando 3s...`);
    await page.waitForTimeout(3000);
    continue;
  }
  await actuarBtn.click();
  console.log(`[${i}] Ataque de remate enviado, esperando resolución...`);
  await page.waitForTimeout(14000);
}

await page.screenshot({ path: 'screenshots/verif_grupo_f_final.png', fullPage: true });
console.log('done');
await browser.close();
