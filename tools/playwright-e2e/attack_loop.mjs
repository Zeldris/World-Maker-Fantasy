import { openGame, snap } from './play.mjs';

async function attackOnce() {
  const { browser, page } = await openGame();
  await page.getByRole('button', { name: /combatir/i }).click();
  await page.waitForTimeout(1000);

  // Detectar fase: "DEFENDERTE" (defensa a ciegas) vs "ACTUAR" (turno de ataque normal)
  const isDefensePhase = (await page.getByRole('button', { name: /^defenderte$/i }).count()) > 0;
  let abilityCard;
  if (isDefensePhase) {
    console.log('Fase: DEFENSA — seleccionando "Defenderse"');
    abilityCard = page.getByRole('button', { name: /^🪨\s*defenderse/i }).first();
    if ((await abilityCard.count()) === 0) {
      abilityCard = page.getByRole('button', { name: /defenderse/i }).first();
    }
  } else {
    console.log('Fase: ATAQUE — seleccionando "Ataque Básico"');
    abilityCard = page.getByRole('button', { name: /ataque básico/i }).first();
  }
  await abilityCard.click();
  await page.waitForTimeout(500);

  const actuarBtns = page.getByRole('button', { name: isDefensePhase ? /^defenderte$/i : /^actuar$/i });
  const n = await actuarBtns.count();
  let clicked = false;
  for (let i=0;i<n;i++){
    const b = actuarBtns.nth(i);
    if (!(await b.isDisabled())) {
      await b.click();
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    console.log('NINGUN boton actuar habilitado - puede que el combate ya haya terminado');
    const bodyText = await page.locator('body').innerText();
    await browser.close();
    return { bodyText, ended: true };
  }

  let bodyText = await page.locator('body').innerText();
  for (let i=0;i<20;i++){
    const waiting = /RESOLVIEND|NARRADOR ESCRIBE|Esperando la narración/i.test(bodyText);
    if (!waiting) break;
    await page.waitForTimeout(4000);
    bodyText = await page.locator('body').innerText();
  }
  // Dar margen extra tras detectar fin de "esperando" para asegurar que el DOM se asentó
  await page.waitForTimeout(2000);

  const scrollable = page.locator('div', { has: page.getByText('Ver historial completo en el Diario') }).last();
  await scrollable.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(300);
  bodyText = await page.locator('body').innerText();
  await page.screenshot({ path: `screenshots/attack_${Date.now()}.png`, fullPage: true });
  await browser.close();
  return { bodyText, ended: false };
}

const ROUNDS = Number(process.argv[2] || 1);
for (let r = 0; r < ROUNDS; r++) {
  console.log(`\n========== RONDA ${r+1}/${ROUNDS} ==========`);
  const { bodyText, ended } = await attackOnce();
  const idx = bodyText.lastIndexOf('TU ACCIÓN');
  console.log(bodyText.slice(Math.max(0, idx - 50), idx + 1500));
  console.log('ENDED:', ended);
  if (ended) {
    console.log('Combate terminado o sin botón habilitado, deteniendo bucle.');
    break;
  }
  // Margen de cortesía antes de la siguiente acción (turnLock)
  await new Promise(res => setTimeout(res, 3000));
}
