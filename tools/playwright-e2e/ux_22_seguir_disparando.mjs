import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';
const acciones = [
  'Observo el horizonte con atención.',
  'Recorro un tramo más de la Hondonada.',
  'Presto atención a los sonidos del entorno.',
  'Sigo avanzando con precaución.',
  'Inspecciono las paredes de arcilla cercanas.',
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(45000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

for (let i = 0; i < acciones.length; i++) {
  const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
  for (let w = 0; w < 6; w++) {
    const disabled = await composer.getAttribute('aria-disabled').catch(() => 'true');
    if (disabled !== 'true') break;
    await page.waitForTimeout(5000);
  }
  await composer.click();
  await composer.fill(acciones[i]);
  await page.getByRole('button', { name: /^actuar$/i }).nth(0).click();
  console.log(`Turno ${i} enviado: "${acciones[i]}"`);
  await page.waitForTimeout(28000);

  const bodyText = await page.textContent('body');
  if (bodyText.includes('Interactuar') || bodyText.includes('busca tu atención')) {
    console.log(`Turno ${i}: ¡Oferta de Interactuar detectada!`);
    await page.screenshot({ path: `screenshot-ux-interactuar2-turno${i}.png`, fullPage: false });
    break;
  }
}

await page.screenshot({ path: 'screenshot-ux-interactuar2-final.png', fullPage: false });

await browser.close();
