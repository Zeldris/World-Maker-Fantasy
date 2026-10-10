import { chromium } from 'playwright';
import { SAVE_ID, opcionesDialogo, verEstado } from './lib.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.setDefaultTimeout(15000);
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);
await verEstado(page, 'recorrido_09a.png');
const opciones = await opcionesDialogo(page).catch((e) => { console.log('err', e.message); return []; });
console.log('Opciones:', JSON.stringify(opciones));
await browser.close();
