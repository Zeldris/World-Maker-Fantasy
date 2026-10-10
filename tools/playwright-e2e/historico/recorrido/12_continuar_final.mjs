import { chromium } from 'playwright';
import { SAVE_ID, elegirOpcionDialogo, opcionesDialogo, verEstado } from './lib.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.setDefaultTimeout(15000);
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

await elegirOpcionDialogo(page, 'CONTINUAR');
await verEstado(page, 'recorrido_12a.png');
const opciones = await opcionesDialogo(page).catch((e) => { console.log('sin opciones:', e.message); return []; });
console.log('Opciones tras Continuar:', JSON.stringify(opciones));

await browser.close();
