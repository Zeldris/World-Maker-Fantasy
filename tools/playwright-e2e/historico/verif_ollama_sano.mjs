import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

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
console.log('URL:', page.url());

await page.getByRole('button', { name: /^Guerrero/ }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /aceptar/i }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /confirmar/i }).click();
await page.waitForTimeout(1500);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill('Exploro con calma.');
await page.waitForTimeout(300);
await page.getByRole('button', { name: /^actuar$/i }).first().click();
console.log('Turno enviado con Ollama ya sano, hora:', new Date().toISOString());
await browser.close();
