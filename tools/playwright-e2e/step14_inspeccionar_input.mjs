import { openGame } from './play.mjs';

const { browser, page } = await openGame();
const textareas = await page.locator('textarea').all();
console.log('textareas:', textareas.length);
for (const t of textareas) {
  console.log('  placeholder=', await t.getAttribute('placeholder'));
}
const inputs = await page.locator('input[type="text"]').all();
console.log('inputs text:', inputs.length);
for (const t of inputs) {
  console.log('  placeholder=', await t.getAttribute('placeholder'));
}
await browser.close();
console.log('OK');
