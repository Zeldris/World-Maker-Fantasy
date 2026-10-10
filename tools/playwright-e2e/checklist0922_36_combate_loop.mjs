import { chromium } from 'playwright';

const SAVE_ID = 'cmu1hsfg10001ribgb2fmv5c1';

async function leerEstado() {
  const res = await fetch(`http://localhost:3001/saves/${SAVE_ID}`);
  return res.json();
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /combatir/i }).click().catch(() => {});
await page.waitForTimeout(1500);

for (let turno = 1; turno <= 6; turno++) {
  const estadoAntes = await leerEstado();
  const orcoAntes = estadoAntes.combateIniciado?.npcs?.[0]?.condicionFisica;
  console.log(`\n=== Turno ${turno}: condición del Orco ANTES = ${orcoAntes} ===`);

  if (!estadoAntes.combateIniciado) {
    console.log('Combate ya cerrado, terminando el bucle.');
    break;
  }
  if (orcoAntes === 'CONVALECIENTE' || orcoAntes === 'MUERTO') {
    console.log('Orco Convaleciente/Muerto, terminando el bucle de ataques.');
    break;
  }

  const composer = page.locator('input[placeholder="O describe tu acción..."]');
  const disabled = await composer.isDisabled().catch(() => true);
  if (disabled) {
    console.log('Composer deshabilitado, esperando a que se habilite...');
    for (let i = 0; i < 60 && (await composer.isDisabled().catch(() => true)); i++) {
      await page.waitForTimeout(1000);
    }
  }

  await composer.click();
  await composer.fill(`Ataco con un golpe directo contra el Orco enfurecido, intento ${turno}.`);
  const actuarBtn = page.getByRole('button', { name: /^actuar$/i }).last();
  await actuarBtn.click();
  console.log(`Ataque ${turno} enviado, esperando resolución...`);

  let resuelto = false;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    const estado = await leerEstado();
    const orcoAhora = estado.combateIniciado?.npcs?.[0]?.condicionFisica;
    if (!estado.combateIniciado || orcoAhora !== orcoAntes) {
      console.log(`[t=${i+1}s] cambio detectado: ${orcoAntes} -> ${orcoAhora ?? 'combate cerrado'}`);
      resuelto = true;
      break;
    }
  }
  if (!resuelto) console.log('Sin cambio detectado tras 60s (puede ser fallo/empate, seguimos).');
}

await page.screenshot({ path: 'checklist0922_36_estado_final.png', fullPage: true });
console.log('Captura final tomada.');

await browser.close();
