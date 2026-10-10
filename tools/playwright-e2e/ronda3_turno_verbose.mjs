import { chromium } from 'playwright';
const SAVE_ID = 'cmtmzyprk0006ri0z9k6wp6ds';
const ACCION = process.argv[2];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (msg) => console.log(`CONSOLE[${msg.type()}]:`, msg.text()));
  page.on('request', (req) => { if (req.url().includes('localhost:3001')) console.log('>> REQ', req.method(), req.url()); });
  page.on('response', (resp) => { if (resp.url().includes('localhost:3001')) console.log('<< RESP', resp.status(), resp.url()); });

  await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const editable = page.locator('[contenteditable="true"]').first();
  await editable.click();
  await page.keyboard.type(ACCION);
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^actuar$/i }).click();
  console.log('=== ENVIADO ===');
  await page.waitForTimeout(20000);
  await browser.close();
})();
