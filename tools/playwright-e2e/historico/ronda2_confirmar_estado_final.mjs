import { chromium } from 'playwright';
const SAVE_ID = 'cmtmzyprk0006ri0z9k6wp6ds';
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  // Escribir texto real para comprobar si con contenido el botón se habilita (confirmaría que
  // el bloqueo es solo "sin texto" y no un characterThinking atascado).
  const editable = page.locator('[contenteditable="true"]').first();
  await editable.click();
  await page.keyboard.type('probando');
  await page.waitForTimeout(300);
  const disabled = await page.getByRole('button', { name: /^actuar$/i }).isDisabled();
  console.log('Con texto escrito, Actuar deshabilitado:', disabled);
  await page.screenshot({ path: 'screenshots/ronda2_11_confirmar.png', fullPage: true });
  await browser.close();
})();
