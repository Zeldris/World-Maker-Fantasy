import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();

console.log('Cancelando acción en curso...');
await page.locator('button', { hasText: 'Cancelar acción' }).click();
await page.waitForTimeout(3000);
let bodyText = await page.locator('body').innerText();
console.log('¿sigue Cancelar acción visible?', bodyText.includes('Cancelar acción'));

// Reintentar cancelar si sigue visible (a veces requiere doble click / confirmación)
if (bodyText.includes('Cancelar acción')) {
  await page.locator('button', { hasText: 'Cancelar acción' }).click();
  await page.waitForTimeout(3000);
  bodyText = await page.locator('body').innerText();
  console.log('tras 2º intento, ¿sigue?', bodyText.includes('Cancelar acción'));
}

await snap(page, 'step22_tras_cancelar');
await browser.close();
console.log('OK');
