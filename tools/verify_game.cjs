/**
 * 起真实浏览器跑一遍游戏，收控制台报错、检查 GLB 是否真的加载成功、截图。
 * 用法：NODE_PATH=<工作区 node_modules> node tools/verify_game.cjs
 */

const { chromium } = require('playwright');
const path = require('path');

const URL = process.env.GAME_URL || 'http://127.0.0.1:3001/';
const SHOT = path.resolve(__dirname, '../docs/preview/game_actual.png');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  } catch (e) {
    browser = await chromium.launch({ headless: true });
  }

  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  const failed = [];

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));
  page.on('requestfailed', req => failed.push(req.url() + ' :: ' + req.failure()?.errorText));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

  await page.waitForFunction(
    () => window.gameApp && window.gameApp.shopMeshes && window.gameApp.shopMeshes.size > 0,
    { timeout: 60000 }
  ).catch(() => {});

  // 让时钟跑一会儿，确认模拟内核在推进
  const t0 = await page.evaluate(() => window.sim && window.sim.minute);
  await page.waitForTimeout(4000);
  const t1 = await page.evaluate(() => window.sim && window.sim.minute);

  const info = await page.evaluate(() => {
    const app = window.gameApp;
    if (!app) return { ok: false };
    const snap = window.sim.snapshot();
    let meshes = 0;
    app.scene.traverse(o => { if (o.isMesh) meshes += 1; });
    return {
      ok: true,
      useGLB: app.useGLB,
      loadedKeys: app.assets.cache.size,
      glbTriangles: Math.round(app.assets.triangles),
      sceneMeshes: meshes,
      shops: app.shopMeshes.size,
      drawCalls: app.renderer.info.render.calls,
      sceneTriangles: app.renderer.info.render.triangles,
      hud: {
        funds: document.getElementById('hud-funds')?.textContent,
        time: document.getElementById('hud-day-time')?.textContent,
        visitors: document.getElementById('hud-visitors')?.textContent,
        control: document.getElementById('hud-control')?.textContent
      },
      sim: {
        day: snap.day,
        minute: snap.minute,
        funds: snap.funds,
        shops: snap.shopsCount,
        visitors: snap.dailyVisitors
      }
    };
  });

  await page.evaluate(() => {
    const app = window.gameApp;
    app.applyCameraMode('panoramic');
    if (app.controls) app.controls.update();
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: SHOT });

  console.log(JSON.stringify({
    info,
    clockAdvanced: { from: t0, to: t1 },
    errors: errors.slice(0, 12),
    failed: failed.slice(0, 8),
    shot: SHOT
  }, null, 2));

  await browser.close();
})().catch(err => {
  console.error('VERIFY FAILED', err);
  process.exit(1);
});
