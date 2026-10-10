import { getPage } from './_conn.mjs';

const { page } = await getPage();
await page.mouse.click(400, 661);
await page.waitForTimeout(300);
await page.keyboard.type('Me acerco despacio a Quio para observarlo de cerca antes de decidir si cazarlo.', { delay: 15 });
await page.waitForTimeout(300);
await page.screenshot({ path: '/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/tools/playwright-e2e/antes_enviar.png' });
