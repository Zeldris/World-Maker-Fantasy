import { chromium } from 'playwright';
import fs from 'node:fs';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const SHOTS_DIR = 'screenshots/probar_npc';
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2500);

const aceptarBtn = page.getByRole('button', { name: /^aceptar$/i });
await aceptarBtn.click();
console.log('Misión aceptada.');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${SHOTS_DIR}/001_mision_aceptada.png` });

const misionesBtn = page.locator('button', { hasText: 'Misiones' }).first();
await misionesBtn.click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${SHOTS_DIR}/002_panel_misiones.png` });
console.log('Panel de misiones abierto.');

await browser.close();
