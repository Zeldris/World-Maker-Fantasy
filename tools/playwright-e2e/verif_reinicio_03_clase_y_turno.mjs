import { chromium } from 'playwright';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtmjkmkv0001riduoyequbdn';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);

await page.getByRole('button', { name: /^Guerrero/ }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /aceptar/i }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /confirmar/i }).click();
await page.waitForTimeout(1500);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Exploro con cuidado.');
await page.waitForTimeout(300);
await page.getByRole('button', { name: /^actuar$/i }).first().click();
console.log('Turno enviado tras reinicio real, hora:', new Date().toISOString());
await browser.close();
