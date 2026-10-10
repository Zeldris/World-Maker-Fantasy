import { abrirPartida, verEstado } from './lib.mjs';

const { browser, page } = await abrirPartida();

// El primer turno de diálogo con Gistera ya se disparó en el intento anterior — esperamos a que
// el modal aparezca (o el botón deje de decir "INTERACTUANDO...").
await page.waitForSelector('text=INTERACTUANDO', { state: 'detached', timeout: 5000 }).catch(() => {});
await page.waitForTimeout(2000);
await verEstado(page, 'recorrido_06a.png');

const opciones = await page.locator('button').allTextContents();
console.log('Botones visibles:', opciones.filter(Boolean));

await browser.close();
