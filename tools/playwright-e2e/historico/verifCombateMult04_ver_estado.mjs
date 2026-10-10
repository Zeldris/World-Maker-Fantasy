import { chromium } from 'playwright';

const SAVE_ID = 'cmteqawx90001rijcmmtqvv7v';
const SHOT_DIR = '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);
await page.screenshot({ path: `${SHOT_DIR}/verifCombateMult04_estado.png`, fullPage: true });
console.log('OK');
await browser.close();
