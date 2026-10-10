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
console.log('URL:', page.url());

await page.getByRole('button', { name: /^Guerrero/ }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /aceptar/i }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /confirmar/i }).click();
await page.waitForTimeout(1500);

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });

// Cazar 2+ Gesgurio a la vez para forzar combate múltiple
await composer.click();
await composer.fill("Salgo a cazar y ataco a 'Gesgurio', 'Gesgurio'.");
await page.waitForTimeout(300);
await page.getByRole('button', { name: /^actuar$/i }).first().click();
console.log('Turno de caza en grupo enviado, esperando resolución (hasta 60s)...');
await page.waitForTimeout(40000);
await page.screenshot({ path: 'screenshots/verif_grupo_01_combate_abierto.png', fullPage: true });
console.log('Screenshot 1: combate abierto (si se disparó)');

await browser.close();
