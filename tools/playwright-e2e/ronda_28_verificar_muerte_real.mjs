import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const habilidadesTab = page.getByRole('button', { name: /habilidades/i }).first();
const inventarioTab = page.getByRole('button', { name: /inventario/i }).first();
const companerosTab = page.getByRole('button', { name: /compañeros/i }).first();
const reinoTab = page.getByRole('button', { name: /reino/i }).first();
const personajeTab = page.getByRole('button', { name: /personaje/i }).first();

console.log('Habilidades disabled:', await habilidadesTab.isDisabled());
console.log('Inventario disabled:', await inventarioTab.isDisabled());
console.log('Compañeros disabled:', await companerosTab.isDisabled());
console.log('Reino disabled:', await reinoTab.isDisabled());
console.log('Personaje disabled (debe ser false):', await personajeTab.isDisabled());

await browser.close();
