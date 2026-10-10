import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:5173/solitario', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.locator('text=Helek Sirik').click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Continuar →' }).click();
await page.waitForTimeout(1000);

await page.getByText('Crear desde cero', { exact: true }).click();
await page.waitForTimeout(500);
await page.getByPlaceholder('Nombre de tu personaje').fill('FixClaseCustom2');
await page.getByPlaceholder('Ej. Ladrona, clérigo, mercenario...').fill('Guerrera de prueba');
await page.getByPlaceholder('¿Qué persigue tu personaje?').fill('Confirmar el fix del modal de clase.');
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Confirmar personaje' }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Continuar →' }).click();
await page.waitForTimeout(1500);

// Ya en "Sus partidas" — pulsar Nueva partida sin recargar la página
await page.getByRole('button', { name: '+ Nueva partida' }).click();
await page.waitForTimeout(4000);
await page.screenshot({ path: 'screenshots/fix03_06_modal.png', fullPage: true });
console.log('URL:', page.url());

await browser.close();
