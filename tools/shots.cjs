/** 抓几张不同机位的实机图，用来核对模型细节与夜景。 */

const { chromium } = require('playwright');
const path = require('path');

const URL = process.env.GAME_URL || 'http://127.0.0.1:3001/';
const OUT = p => path.resolve(__dirname, '../docs/preview/' + p);

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  } catch (e) {
    browser = await chromium.launch({ headless: true });
  }
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.gameApp?.shopMeshes?.size > 0, { timeout: 60000 });
  await page.waitForTimeout(1500);

  const shot = async (name, setup) => {
    await page.evaluate(setup);
    await page.waitForTimeout(900);
    await page.screenshot({ path: OUT(name) });
    console.log('shot', name);
  };

  await shot('game_rpg.png', () => {
    const app = window.gameApp;
    window.sim.speed = 0;
    app.playerPos.set(0, 0, 10);
    app.applyCameraMode('rpg');
  });

  await shot('game_shop_closeup.png', () => {
    const app = window.gameApp;
    app.camera.fov = 42;
    app.camera.updateProjectionMatrix();
    app.camera.position.set(-6, 9, 26);
    app.controls.target.set(-20, 3.4, -6);
    app.controls.update();
  });

  await shot('game_night.png', () => {
    const app = window.gameApp;
    window.sim.minute = 20 * 60;
    app.timePresetOverride = 'night';
    app.camera.position.set(34, 26, 34);
    app.controls.target.set(0, 2, 0);
    app.controls.update();
  });

  await browser.close();
})().catch(err => {
  console.error('SHOTS FAILED', err);
  process.exit(1);
});
