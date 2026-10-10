import { chromium } from 'playwright';

const SAVE_ID = 'cmthkoamc0001rixt7rl83dab';
const browser = await chromium.launch();
const page = await browser.newPage();

const classifyBodies = [];
const narrateBodies = [];
page.on('request', (req) => {
  if (req.url().includes('/turn/classify')) {
    classifyBodies.push(req.postData());
  }
  if (req.url().includes('/turn/narrate')) {
    narrateBodies.push(req.postData());
  }
});

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(4000);

const input = page.locator('[contenteditable="true"]').first();
await input.click();
await input.fill('Viajo a Ketg\'lukar');
await page.getByRole('button', { name: /^actuar$/i }).first().click();
await page.waitForTimeout(15000);

console.log('=== CLASSIFY REQUEST BODIES ===');
for (const b of classifyBodies) console.log(b);
console.log('=== NARRATE REQUEST BODIES ===');
for (const b of narrateBodies) console.log(b);

await browser.close();
