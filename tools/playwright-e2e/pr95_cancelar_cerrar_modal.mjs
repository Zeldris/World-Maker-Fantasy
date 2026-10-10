import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(536, 402); // Cancelar
await page.waitForTimeout(500);
await page.mouse.click(1212, 69); // Cerrar modal
await page.waitForTimeout(800);
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/tras_cerrar_todo.png' });
const text = await page.evaluate(() => document.body.innerText);
console.log(text.slice(0, 2500));
