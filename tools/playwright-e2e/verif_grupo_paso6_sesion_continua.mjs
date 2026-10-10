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

let mataronAlguno = false;
for (let i = 1; i <= 30; i++) {
  // Si aparece la tarjeta Matar/Capturar/Clemente, resolverla YA, sin escribir nada más
  const matarBtn = page.getByRole('button', { name: /^matar$/i });
  if (await matarBtn.count()) {
    console.log(`[${i}] Tarjeta Matar/Capturar/Clemente visible — pulsando Matar`);
    await matarBtn.first().click();
    mataronAlguno = true;
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `screenshots/verif_grupo_c_matar_${i}.png`, fullPage: true });
    continue;
  }

  const enemigosVivos = await page.locator('text=/Zense Ceniza #\\d/').count();
  if (enemigosVivos === 0) {
    console.log(`[${i}] Sin tarjetas de enemigo — posible fin de combate.`);
    break;
  }

  const composer = page.getByRole('textbox');
  const composerReady = await composer.isEnabled().catch(() => false);
  if (!composerReady) {
    console.log(`[${i}] composer deshabilitado, esperando 3s...`);
    await page.waitForTimeout(3000);
    continue;
  }

  await composer.click();
  await composer.fill('Ataco con todas mis fuerzas al rival que tengo delante.');
  await page.waitForTimeout(300);
  const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
  const actuarEnabled = await actuarBtn.isEnabled().catch(() => false);
  if (!actuarEnabled) {
    console.log(`[${i}] Actuar deshabilitado, esperando 3s...`);
    await page.waitForTimeout(3000);
    continue;
  }
  await actuarBtn.click();
  console.log(`[${i}] Ataque enviado, esperando resolución...`);
  await page.waitForTimeout(14000);
}

await page.screenshot({ path: 'screenshots/verif_grupo_c_final.png', fullPage: true });
console.log('mataron alguno:', mataronAlguno);
console.log('done');
await browser.close();
