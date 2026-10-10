import { chromium } from 'playwright';

const SAVE_ID = 'cmteqawx90001rijcmmtqvv7v';
const SHOT_DIR = '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);
await page.mouse.wheel(0, 3000);
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOT_DIR}/verifCombateMult07_ver.png`, fullPage: true });
const bodyText = await page.locator('body').innerText();
console.log(bodyText.slice(-3000));
await browser.close();
console.log('OK');
