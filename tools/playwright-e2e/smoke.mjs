// Comprueba que el navegador arranca y que el frontend responde (FRONT, por defecto :5173).
import { abrirNavegador, FRONT } from './lib.mjs';

const { browser, page } = await abrirNavegador();
await page.goto(FRONT);
await page.waitForTimeout(1000);
console.log('title:', await page.title());
await browser.close();
console.log('OK');
