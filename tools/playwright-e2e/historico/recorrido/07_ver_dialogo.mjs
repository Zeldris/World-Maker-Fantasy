import { chromium } from 'playwright';
import { SAVE_ID, opcionesDialogo, verEstado } from './lib.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.setDefaultTimeout(15000);
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);
await verEstado(page, 'recorrido_07a.png');

const opciones = await opcionesDialogo(page).catch((e) => { console.log('Error leyendo opciones:', e.message); return []; });
console.log('Opciones de diálogo:', JSON.stringify(opciones));

await browser.close();
