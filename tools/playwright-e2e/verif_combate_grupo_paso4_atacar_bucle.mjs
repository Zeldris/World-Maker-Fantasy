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

for (let i = 1; i <= 10; i++) {
  const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
  const composerVisible = await composer.count();
  if (composerVisible) {
    await composer.click();
    await composer.fill('Ataco con todas mis fuerzas al rival que tengo delante.');
    await page.waitForTimeout(300);
  }
  const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).first();
  await actuarBtn.click();
  console.log(`Ataque #${i} enviado, esperando resolución...`);
  await page.waitForTimeout(15000);

  const combatientesVivos = await page.locator('text=/Zense Ceniza #\\d/').count();
  console.log(`  combatientes enemigos visibles tras ataque #${i}: ${combatientesVivos}`);
  await page.screenshot({ path: `screenshots/verif_grupo_06_ataque_${i}.png`, fullPage: true });

  const combateSigueAbierto = await page.getByText('Combatir', { exact: false }).count();
  if (combatientesVivos === 0) {
    console.log('Sin más "Zense Ceniza #N" visibles — posible fin de combate o resumen.');
    break;
  }
}

await page.screenshot({ path: 'screenshots/verif_grupo_07_estado_final.png', fullPage: true });
console.log('done');
await browser.close();
