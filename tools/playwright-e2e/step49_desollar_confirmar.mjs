import { openGame } from './play.mjs';

const { browser, page } = await openGame();
await page.waitForTimeout(1500);

await page.getByRole('button', { name: /presas caídas sin desollar/i }).click();
await page.waitForTimeout(1000);

// Pulsa "+" en cada material disponible (Hueso, Cráneo, Piel, Garras).
const plusButtons = page.getByRole('button', { name: '+' });
const count = await plusButtons.count();
console.log('botones + encontrados:', count);
for (let i = 0; i < count; i++) {
  await plusButtons.nth(i).click();
}
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/step49_seleccionado.png', fullPage: true });

const aceptar = page.getByRole('button', { name: /^aceptar$/i });
console.log('aceptar disabled:', await aceptar.isDisabled());
await aceptar.click();
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/step49_tras_aceptar.png', fullPage: true });

const bodyText = await page.locator('body').innerText();
console.log('=== tras aceptar ===');
console.log(bodyText.slice(0, 1500));

await browser.close();
console.log('OK');
