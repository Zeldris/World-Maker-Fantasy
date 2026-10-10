import { openGame } from './play.mjs';

const { browser, page } = await openGame();
await page.getByRole('button', { name: /combatir/i }).click();
await page.waitForTimeout(1000);

const editables = await page.locator('[contenteditable="true"]').all();
console.log('contenteditable=true count:', editables.length);
for (const e of editables) {
  console.log(' aria-label=', await e.getAttribute('aria-label'), 'placeholder=', await e.getAttribute('data-placeholder'));
}

const textareas = await page.locator('textarea').all();
console.log('textarea count:', textareas.length);

const actuarBtns = await page.getByRole('button', { name: /^actuar$/i }).all();
console.log('actuar btn count:', actuarBtns.length);
for (let i=0;i<actuarBtns.length;i++){
  console.log(`actuar[${i}] disabled=`, await actuarBtns[i].isDisabled());
}
await browser.close();
console.log('OK');
