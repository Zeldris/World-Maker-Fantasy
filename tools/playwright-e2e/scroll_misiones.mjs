import { chromium } from 'playwright';
import fs from 'node:fs';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const SHOTS_DIR = 'screenshots/probar_npc';
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2500);

const misionesBtn = page.locator('button', { hasText: 'Misiones' }).first();
await misionesBtn.click();
await page.waitForTimeout(800);

const modalContent = page.locator('text=ACTIVAS').locator('..').locator('..');
await page.mouse.wheel(0, 600);
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOTS_DIR}/003_misiones_scroll.png` });
console.log('Captura tras scroll guardada.');

const bodyText = await page.locator('body').innerText();
console.log('Contiene "Orco Enfurecido":', bodyText.includes('Orco Enfurecido'));
console.log('Contiene "Acabar con":', bodyText.includes('Acabar con'));

await browser.close();
