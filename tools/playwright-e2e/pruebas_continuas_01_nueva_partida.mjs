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
console.log('SAVE_ID:', url.split('/').pop());

await page.getByRole('button', { name: /^Guerrero/ }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /aceptar/i }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /confirmar/i }).click();
await page.waitForTimeout(1500);

await page.screenshot({ path: 'screenshots/pc_01_inicio.png', fullPage: true });
console.log('done');
await browser.close();
