import { chromium } from 'playwright';
const SAVE_ID = 'cmtmzyprk0006ri0z9k6wp6ds';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.mouse.wheel(0, 5000);
  await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('*')).filter(el => {
      const s = getComputedStyle(el);
      return (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
    });
    for (const p of panels) p.scrollTop = p.scrollHeight;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/ronda3_check2.png', fullPage: true });
  await browser.close();
})();
