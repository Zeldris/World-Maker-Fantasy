import { openGame, snap } from './play.mjs';

const { browser, page } = await openGame();

// Comprobar si hay botón para continuar/avanzar la actividad en curso
const buttons = await page.getByRole('button').allInnerTexts();
console.log('BOTONES:', JSON.stringify(buttons));

await snap(page, 'step20_estado');
await browser.close();
console.log('OK');
