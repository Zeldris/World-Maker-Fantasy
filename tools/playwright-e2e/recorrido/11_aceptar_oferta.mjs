import { chromium } from 'playwright';
import { SAVE_ID, elegirOpcionDialogo, opcionesDialogo, salirDialogo, verEstado } from './lib.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.setDefaultTimeout(15000);
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

await elegirOpcionDialogo(page, 'Aceptar la oferta');
await verEstado(page, 'recorrido_11a.png');

const opciones = await opcionesDialogo(page).catch((e) => { console.log('sin opciones (posible cierre):', e.message); return []; });
console.log('Opciones tras aceptar:', JSON.stringify(opciones));

if (opciones.length === 0) {
  // El modal puede haberse cerrado solo (cierre:true del LLM) o seguir esperando "Salir"
  await salirDialogo(page);
  console.log('Intentado salir del diálogo');
}

await browser.close();
