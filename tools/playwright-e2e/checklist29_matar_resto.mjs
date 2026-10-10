import { chromium } from 'playwright';

const SAVE_ID = 'cmthl2fb4000wrixt2hckti84';

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('response', async (res) => {
  if (res.url().includes('matar') || res.url().includes('/turn/')) {
    console.log(res.request().method(), res.url(), '->', res.status());
  }
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1500);

let matarBtn = page.getByRole('button', { name: /^matar$/i });
let count = await matarBtn.count();
console.log('Botones Matar iniciales:', count);

while (count > 0) {
  await matarBtn.first().click();
  await page.waitForTimeout(1500);
  matarBtn = page.getByRole('button', { name: /^matar$/i });
  count = await matarBtn.count();
  console.log('Botones Matar restantes:', count);
}

await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/checklist29_01_tras_matar_todos.png', fullPage: true });

await browser.close();
