import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:5173');
await page.waitForTimeout(1500);

// Buscar el botón/tarjeta de "TEST Claude - no tocar" en la pantalla de selección de partida.
const partidaBtn = page.getByText('Continuar como Gorhorn', { exact: false }).first();
if (await partidaBtn.count() === 0) {
  console.log('No se encontró la partida en pantalla. HTML visible:');
  console.log(await page.locator('body').innerText());
  await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr01_no_encontrada.png', fullPage: true });
} else {
  await partidaBtn.click();
  await page.waitForTimeout(3000);
  console.log('Texto visible tras cargar:');
  console.log(await page.locator('body').innerText());
  await page.screenshot({ path: '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/pr01_cargada.png', fullPage: true });
}

await browser.close();
