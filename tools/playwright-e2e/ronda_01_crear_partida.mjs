import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto('http://localhost:5173/solitario');
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /Helek Sirik/ }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Continuar →' }).click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Crear desde cero' }).click();
await page.waitForTimeout(500);

await page.getByPlaceholder('Nombre de tu personaje').fill('Gorhorn');
await page.getByPlaceholder('Ej. Ladrona, clérigo, mercenario...').fill('Guerrero Maktor, ronda de reverificación');
await page.getByPlaceholder('¿Qué persigue tu personaje?').fill('Recuperar el honor de su clan.');

await page.getByRole('button', { name: 'Confirmar personaje' }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Continuar →' }).click();
await page.waitForTimeout(1500);

await page.getByRole('button', { name: /^Medio/ }).click();
await page.waitForTimeout(500);

await page.getByRole('button', { name: '+ Nueva partida' }).click();
await page.waitForTimeout(5000);

const url = page.url();
console.log('URL final:', url);
const saveId = url.split('/').pop();
console.log('SAVE_ID:', saveId);

await page.screenshot({ path: 'screenshot-ronda-01-creada.png', fullPage: false });

await browser.close();
