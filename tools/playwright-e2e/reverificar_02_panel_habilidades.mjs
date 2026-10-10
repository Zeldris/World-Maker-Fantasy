import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s'; // "TEST Claude - no tocar"

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const habilidadesTab = page.getByRole('button', { name: /habilidades/i }).first();
console.log('Botón Habilidades disabled:', await habilidadesTab.isDisabled());

const inventarioTab = page.getByRole('button', { name: /inventario/i }).first();
console.log('Botón Inventario disabled:', await inventarioTab.isDisabled());
const companerosTab = page.getByRole('button', { name: /compañeros/i }).first();
console.log('Botón Compañeros disabled:', await companerosTab.isDisabled());
const reinoTab = page.getByRole('button', { name: /reino/i }).first();
console.log('Botón Reino disabled:', await reinoTab.isDisabled());
const personajeTab = page.getByRole('button', { name: /personaje/i }).first();
console.log('Botón Personaje disabled (debe ser false — no está en la lista de bloqueo):', await personajeTab.isDisabled());

await habilidadesTab.hover();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshot-02-habilidades.png', fullPage: false });

await browser.close();
