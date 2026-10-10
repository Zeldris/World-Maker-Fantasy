import { chromium } from 'playwright';
const SAVE_ID = 'cmten4peu008aritr6km5hcc9';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

// Buscar cualquier icono/botón que abra el menu de acciones rapidas (Cazar, Recolectar, etc)
const allText = await page.locator('body').innerText();
console.log(allText.slice(0, 1500));
console.log('---');

// Revisar si hay iconos SVG con title "Cazar"
const svgTitles = await page.locator('svg title').allInnerTexts();
console.log('SVG titles:', svgTitles);

await browser.close();
console.log('OK');
