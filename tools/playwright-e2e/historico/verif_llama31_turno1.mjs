import { chromium } from 'playwright';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmu1hsfg10001ribgb2fmv5c1';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(SAVE_URL);
  await page.waitForTimeout(2000);

  const guerreroOption = page.getByText('Guerrero', { exact: true });
  if (await guerreroOption.isVisible({ timeout: 3000 }).catch(() => false)) {
    await guerreroOption.click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'ACEPTAR' }).click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'CONFIRMAR' }).click();
    await page.waitForTimeout(2000);
    console.log('Clase confirmada.');
  } else {
    console.log('Clase ya estaba confirmada de antes, sin modal.');
  }

  const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
  const isDisabled = await composer.isDisabled().catch(() => true);
  console.log('Composer disabled ANTES de escribir:', isDisabled);
  if (isDisabled) {
    console.log('ABORTADO: el composer ya está deshabilitado, hay un turno pendiente sin resolver de antes.');
  } else {
    await composer.click();
    await composer.fill('Observo el cielo nocturno tratando de reconocer las constelaciones.');
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /^actuar$/i }).first().click();
    console.log('Turno 1 enviado:', new Date().toISOString());
  }
} finally {
  await browser.close();
  console.log('Browser cerrado.');
}
