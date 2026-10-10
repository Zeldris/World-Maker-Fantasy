import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s');
await page.waitForTimeout(1500);
const esperando = page.getByText('Esperando la narración de tu último turno...');
const stillWaiting = await esperando.isVisible().catch(() => false);
console.log('Sigue esperando narración:', stillWaiting);
if (stillWaiting) {
  const start = Date.now();
  await esperando.waitFor({ state: 'hidden', timeout: 60000 }).catch((e) => console.log('timeout esperando:', e.message));
  console.log('Narración lista tras', ((Date.now() - start) / 1000).toFixed(1), 's');
}
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/paso18_final.png', fullPage: true });
await browser.close();
