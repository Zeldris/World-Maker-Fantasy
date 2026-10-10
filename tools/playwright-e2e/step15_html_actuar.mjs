import { openGame } from './play.mjs';

const { browser, page } = await openGame();
const actuarBtns = await page.getByRole('button', { name: /actuar/i }).all();
console.log('botones actuar:', actuarBtns.length);
for (let i=0;i<actuarBtns.length;i++){
  const html = await actuarBtns[i].evaluate(el => el.closest('form,div')?.outerHTML?.slice(0,1500));
  console.log(`--- botón ${i} contexto ---`);
  console.log(html);
}
await browser.close();
console.log('OK');
