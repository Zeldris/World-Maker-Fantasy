import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(60000);

await page.goto('http://localhost:5173/');
await page.waitForTimeout(1500);
await page.getByText('En solitario', { exact: false }).first().click();
await page.waitForTimeout(1500);
await page.getByText('Helek Sirik').first().click();
await page.waitForTimeout(500);
await page.getByText('Continuar', { exact: false }).click();
await page.waitForTimeout(1500);
await page.getByText('Gorhorn', { exact: true }).first().click();
await page.waitForTimeout(500);
await page.getByText('Continuar', { exact: false }).click();
await page.waitForTimeout(1500);
await page.getByText('+ Nueva partida', { exact: false }).click();
await page.waitForTimeout(3000);
const url = page.url();
console.log('URL:', url);
const saveId = url.split('/').pop();
console.log('SAVE_ID:', saveId);

await page.getByRole('button', { name: /^Guerrero/ }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /aceptar/i }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /confirmar/i }).click();
await page.waitForTimeout(1500);

// Abrir el modal de Caza (icono/botón lateral) en vez de texto libre
await page.getByRole('button', { name: /Habilidades/i }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: 'screenshots/verif_modal_01_habilidades.png', fullPage: true });
const buttons = await page.getByRole('button').allTextContents();
console.log('Botones en Habilidades:', JSON.stringify(buttons));

await browser.close();
