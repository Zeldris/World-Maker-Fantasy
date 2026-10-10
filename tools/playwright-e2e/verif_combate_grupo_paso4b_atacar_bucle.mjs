import { chromium } from 'playwright';

const SAVE_ID = 'cmtmlfk420025ri85hnrpxy66';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(60000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2500);

const combatirBtn = page.getByRole('button', { name: /Combatir/i });
if (await combatirBtn.count()) {
  await combatirBtn.first().click();
  await page.waitForTimeout(1200);
}

for (let i = 1; i <= 25; i++) {
  const enemigosVivos = await page.locator('text=/Zense Ceniza #\\d/').count();
  console.log(`--- Intento #${i}, tarjetas de enemigo visibles: ${enemigosVivos} ---`);
  if (enemigosVivos === 0) {
    console.log('Sin enemigos visibles — combate resuelto o cambió de vista.');
    break;
  }

  const composer = page.getByRole('textbox');
  let composerReady = await composer.isEnabled().catch(() => false);
  for (let wait = 0; wait < 6 && !composerReady; wait++) {
    await page.waitForTimeout(3000);
    composerReady = await composer.isEnabled().catch(() => false);
  }
  if (!composerReady) {
    console.log('  composer sigue deshabilitado tras esperar — screenshot y sigo con el próximo intento.');
    await page.screenshot({ path: `screenshots/verif_grupo_b_composer_disabled_${i}.png`, fullPage: true });
    await page.waitForTimeout(2000);
    continue;
  }
  await composer.click();
  await composer.fill('Ataco con todas mis fuerzas al rival que tengo delante.');
  await page.waitForTimeout(300);

  const actuarBtnBottom = page.getByRole('button', { name: /^actuar$/i }).last();
  const enabled = await actuarBtnBottom.isEnabled().catch(() => false);
  console.log(`  botón Actuar (inferior) habilitado: ${enabled}`);
  if (!enabled) {
    await page.screenshot({ path: `screenshots/verif_grupo_b_disabled_${i}.png`, fullPage: true });
    console.log('  Actuar sigue deshabilitado, abortando bucle.');
    break;
  }
  await actuarBtnBottom.click();
  console.log(`  Ataque #${i} enviado, esperando resolución...`);
  await page.waitForTimeout(15000);
  await page.screenshot({ path: `screenshots/verif_grupo_b_ataque_${i}.png`, fullPage: true });
}

await page.screenshot({ path: 'screenshots/verif_grupo_b_final.png', fullPage: true });
console.log('done');
await browser.close();
