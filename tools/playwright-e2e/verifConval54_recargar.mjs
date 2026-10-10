import { chromium } from 'playwright';
const SAVE_ID = 'cmten4peu008aritr6km5hcc9';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));

// Simular una sesión real: cargar, ver el estado CONVALECIENTE, y luego recargar (F5) sin pulsar nada
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);
console.log('--- Primera carga, antes de F5 ---');
let bodyText = await page.locator('body').innerText();
console.log('¿Contiene "CONVALECIENTE"?', bodyText.includes('CONVALECIENTE'));
console.log('¿Contiene "MATAR"?', bodyText.includes('MATAR'));
console.log('¿Contiene "CLEMENTE"?', bodyText.includes('CLEMENTE'));

// Ahora RECARGAR la página (F5 real, no otra navegación)
await page.reload();
console.log('--- Página recargada (F5) ---');
await page.waitForTimeout(4000);
await page.screenshot({ path: 'screenshots/verifConval54_tras_recarga.png', fullPage: true });

bodyText = await page.locator('body').innerText();
console.log('¿Contiene "CONVALECIENTE"?', bodyText.includes('CONVALECIENTE'));
console.log('¿Contiene "MATAR"?', bodyText.includes('MATAR'));
console.log('¿Contiene "CLEMENTE"?', bodyText.includes('CLEMENTE'));
console.log(bodyText.slice(-1500));

// Comprobar si el composer libre está deshabilitado
const actuarLibre = page.getByRole('button', { name: /^actuar$/i }).first();
const disabled = await actuarLibre.isDisabled().catch(() => 'N/A');
console.log('Botón Actuar (composer libre) deshabilitado:', disabled);

await browser.close();
console.log('OK');
