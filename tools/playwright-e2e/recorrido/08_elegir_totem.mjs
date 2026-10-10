import { chromium } from 'playwright';
import { SAVE_ID, opcionesDialogo, elegirOpcionDialogo, verEstado } from './lib.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.setDefaultTimeout(15000);
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

await elegirOpcionDialogo(page, 'Inquirir sobre el significado del símbolo Maktor');
await verEstado(page, 'recorrido_08a.png');

const opciones = await opcionesDialogo(page).catch(() => []);
console.log('Opciones tras vuelta 2:', JSON.stringify(opciones));

await browser.close();
