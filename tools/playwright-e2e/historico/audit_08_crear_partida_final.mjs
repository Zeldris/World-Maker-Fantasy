import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(20000);

await page.goto('http://localhost:5173/solitario');
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /Helek Sirik/ }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Continuar →' }).click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Crear desde cero' }).click();
await page.waitForTimeout(500);

await page.getByPlaceholder('Nombre de tu personaje').fill('PruebaAuditoria3');
await page.getByPlaceholder('Ej. Ladrona, clérigo, mercenario...').fill('Guerrera de prueba de auditoría');
await page.getByPlaceholder('¿Qué persigue tu personaje?').fill('Probar que las habilidades de nivel 1 aparecen bien.');

await page.getByRole('button', { name: 'Confirmar personaje' }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Continuar →' }).click();
await page.waitForTimeout(1500);

await page.getByRole('button', { name: /^Medio/ }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/audit_08_dificultad_elegida.png', fullPage: true });

await page.getByRole('button', { name: '+ Nueva partida' }).click();
await page.waitForTimeout(4000);
console.log('URL final:', page.url());
await page.screenshot({ path: 'screenshots/audit_08_partida_creada.png', fullPage: true });

await browser.close();
