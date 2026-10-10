import { chromium } from 'playwright';

const SAVE_ID = 'cmteh3cle0054riet4kmyj0rt';
const STORAGE = '/tmp/tarkor_pw_state.json';

export async function openGame() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', err => console.log('[pageerror]', err.message));
  await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
  await page.waitForTimeout(2000);
  return { browser, page };
}

export async function snap(page, name) {
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  const bodyText = await page.locator('body').innerText();
  console.log(`=== ${name} ===`);
  console.log(bodyText.slice(0, 3000));
  return bodyText;
}
