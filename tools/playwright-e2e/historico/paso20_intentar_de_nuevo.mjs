import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('response', (res) => {
  if (res.url().includes('/turn/')) console.log('RED:', res.status(), res.url());
});

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(1500);
const esperando = page.getByText('Esperando la narración de tu último turno...');
console.log('Sigue esperando ya al cargar:', await esperando.isVisible().catch(() => false));
const cancelBtn = page.getByRole('button', { name: 'Cancelar acción' });
console.log('Botón cancelar visible:', await cancelBtn.isVisible().catch(() => false));
await page.screenshot({ path: 'screenshots/paso20_estado_actual.png', fullPage: true });
await browser.close();
