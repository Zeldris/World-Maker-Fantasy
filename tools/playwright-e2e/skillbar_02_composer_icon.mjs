import { chromium } from 'playwright';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);

// El icono está pegado al composer, esquina inferior izquierda — buscar por posición/estructura
// en vez de texto (podría no tener texto accesible).
const composerArea = page.locator('div').filter({ has: page.locator('input[placeholder="¿Qué hace tu personaje?"]') }).last();
const allButtonsNearComposer = await page.locator('button').all();
console.log('Total botones en la página:', allButtonsNearComposer.length);

// Buscar el botón concreto con aria-label o title relacionado a "barra" o "habilidad"
for (const btn of allButtonsNearComposer) {
  const aria = await btn.getAttribute('aria-label').catch(() => null);
  const title = await btn.getAttribute('title').catch(() => null);
  const text = await btn.textContent().catch(() => '');
  if ((aria && /barra|habilidad/i.test(aria)) || (title && /barra|habilidad/i.test(title)) || (text && text.includes('✨'))) {
    console.log('Candidato:', JSON.stringify({ aria, title, text: text?.slice(0, 30) }));
  }
}

await browser.close();
