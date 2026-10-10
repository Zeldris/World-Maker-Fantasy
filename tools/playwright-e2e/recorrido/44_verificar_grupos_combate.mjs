import { abrirPartida, SAVE_ID } from './lib.mjs';

const { browser, page } = await abrirPartida();

// Panel de Compañeros — buscar el botón/tab correspondiente.
await page.getByRole('button', { name: /compa[ñn]eros/i }).first().click();
await page.waitForTimeout(600);

const screenshotDir = '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad';
await page.screenshot({ path: `${screenshotDir}/44_panel_companeros.png` });

const botonGrupos = page.getByRole('button', { name: /grupos de combate/i });
const visible = await botonGrupos.isVisible().catch(() => false);
console.log('Botón "Grupos de combate" visible:', visible);

if (visible) {
  await botonGrupos.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${screenshotDir}/44_modal_grupos.png` });

  const grupo1Texto = await page.locator('text=Grupo 1').first().isVisible().catch(() => false);
  const cenizaVisible = await page.locator('text=Ceniza').first().isVisible().catch(() => false);
  console.log('Grupo 1 visible:', grupo1Texto, '| Ceniza visible:', cenizaVisible);

  const nuevoGrupoBtn = page.getByRole('button', { name: /nuevo grupo/i });
  if (await nuevoGrupoBtn.isVisible().catch(() => false)) {
    await nuevoGrupoBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${screenshotDir}/44_grupo2_creado.png` });
    const grupo2Texto = await page.locator('text=Grupo 2').first().isVisible().catch(() => false);
    console.log('Grupo 2 creado y visible:', grupo2Texto);
  }
} else {
  console.log('No se encontró el botón — revisando texto de la página...');
  const bodyText = await page.locator('body').innerText();
  console.log(bodyText.slice(0, 2000));
}

await browser.close();
