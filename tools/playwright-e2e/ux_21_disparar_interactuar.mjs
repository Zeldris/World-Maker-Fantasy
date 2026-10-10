import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';
const acciones = [
  'Miro a mi alrededor, observando el terreno con calma.',
  'Camino un poco, atento a cualquier sonido o movimiento.',
  'Me detengo a escuchar el viento entre las rocas.',
  'Sigo explorando la zona con cuidado.',
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(45000);
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

for (let i = 0; i < acciones.length; i++) {
  const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
  const disabled = await composer.getAttribute('aria-disabled').catch(() => 'true');
  if (disabled === 'true') {
    console.log(`Turno ${i}: composer bloqueado, esperando...`);
    await page.waitForTimeout(10000);
  }
  await composer.click();
  await composer.fill(acciones[i]);
  await page.getByRole('button', { name: /^actuar$/i }).nth(0).click();
  console.log(`Turno ${i} enviado: "${acciones[i]}" — esperando resolución...`);
  await page.waitForTimeout(28000);

  const bodyText = await page.textContent('body');
  if (bodyText.includes('Interactuar') || bodyText.includes('busca tu atención')) {
    console.log(`Turno ${i}: ¡Oferta de Interactuar detectada!`);
    await page.screenshot({ path: `screenshot-ux-interactuar-turno${i}.png`, fullPage: false });
    break;
  }
}

await page.screenshot({ path: 'screenshot-ux-interactuar-final.png', fullPage: false });

await browser.close();
