/**
 * 樱町计划 (SakuraBlock) - 程序化贴图生成器 (src/textures.js)
 * 生成日式柏油马路、涩谷风全向斑马线、店铺招牌、传统暖帘、自动贩卖机、Q版角色五官、樱花花瓣等内嵌贴图。
 */
import * as THREE from 'three';

export class TextureFactory {
  static createRoadTexture(isVertical = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2d333b';
    ctx.fillRect(0, 0, 512, 512);

    // 柏油颗粒质感
    for (let i = 0; i < 3500; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    ctx.save();
    if (isVertical) {
      ctx.translate(256, 256);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-256, -256);
    }

    // 两侧蓝色自行车专用道 + 白实线
    ctx.fillStyle = 'rgba(14, 165, 233, 0.22)';
    ctx.fillRect(0, 20, 512, 42);
    ctx.fillRect(0, 450, 512, 42);

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 16, 512, 6);
    ctx.fillRect(0, 62, 512, 4);
    ctx.fillRect(0, 446, 512, 4);
    ctx.fillRect(0, 490, 512, 6);

    // 中央黄色加白色双虚线
    ctx.fillStyle = '#f59e0b';
    for (let x = 20; x < 512; x += 84) {
      ctx.fillRect(x, 252, 48, 8);
    }

    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(isVertical ? 1 : 4, isVertical ? 4 : 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  static createScrambleCrossingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2b3139';
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = '#f1f5f9';
    // 四向斑马线
    for (let i = 64; i <= 420; i += 32) {
      ctx.fillRect(i, 18, 18, 76);   // 北
      ctx.fillRect(i, 418, 18, 76);  // 南
      ctx.fillRect(18, i, 76, 18);   // 西
      ctx.fillRect(418, i, 76, 18);  // 东
    }

    // 涩谷风斜向对角斑马线
    ctx.save();
    ctx.translate(256, 256);
    ctx.rotate(Math.PI / 4);
    for (let i = -180; i <= 180; i += 28) {
      ctx.fillRect(i, -26, 14, 52);
    }
    ctx.rotate(Math.PI / 2);
    for (let i = -180; i <= 180; i += 28) {
      ctx.fillRect(i, -26, 14, 52);
    }
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  static createSidewalkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#dcd6cc';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = '#c2bab0';
    ctx.lineWidth = 3;
    for (let x = 0; x <= 256; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(256, x); ctx.stroke();
    }

    // 黄色盲道砖
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 210, 256, 18);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 16);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  static createSignboardTexture(text, bgColorHex = 0x1e3a8a, textColor = '#ffffff') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');

    const hexStr = '#' + bgColorHex.toString(16).padStart(6, '0');
    ctx.fillStyle = hexStr;
    ctx.fillRect(0, 0, 512, 160);

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 496, 144);

    ctx.fillStyle = textColor;
    ctx.font = '900 54px "Hiragino Sans", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 82);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  static createNorenTexture(text, bgColorHex = 0x991b1b) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const hexStr = '#' + bgColorHex.toString(16).padStart(6, '0');
    ctx.fillStyle = hexStr;
    ctx.fillRect(0, 0, 256, 128);

    // 暖帘分片缝隙
    ctx.clearRect(82, 22, 6, 106);
    ctx.clearRect(168, 22, 6, 106);

    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, 244, 116);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px "Hiragino Mincho ProN", "Songti SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 68);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  static createVendingMachineTexture(brandColor = '#0284c7') {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = brandColor;
    ctx.fillRect(0, 0, 128, 256);

    // 白色展示窗
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(10, 16, 108, 128);

    // 三排彩色饮料罐
    const canColors = ['#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899', '#a855f7'];
    for (let r = 0; r < 3; r++) {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(14, 48 + r * 38, 100, 6);
      for (let c = 0; c < 5; c++) {
        ctx.fillStyle = canColors[(r * 5 + c) % canColors.length];
        ctx.fillRect(18 + c * 19, 24 + r * 38, 13, 22);
      }
    }

    // 投币口与黑色取物口
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(82, 154, 32, 28);
    ctx.fillRect(16, 196, 96, 42);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  static createChibiFaceTexture(eyeColor = '#1e293b') {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffe4d6';
    ctx.fillRect(0, 0, 128, 128);

    // 腮红
    ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
    ctx.beginPath(); ctx.arc(30, 78, 12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(98, 78, 12, 0, Math.PI * 2); ctx.fill();

    // 大眼睛
    ctx.fillStyle = eyeColor;
    ctx.beginPath(); ctx.ellipse(38, 62, 9, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(90, 62, 9, 12, 0, 0, Math.PI * 2); ctx.fill();

    // 眼神高光
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(35, 57, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(87, 57, 3.5, 0, Math.PI * 2); ctx.fill();

    // 微笑
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(64, 78, 9, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  static createSakuraPetalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fbcfe8';
    ctx.beginPath();
    ctx.moveTo(32, 56);
    ctx.bezierCurveTo(8, 40, 8, 14, 24, 10);
    ctx.lineTo(32, 20);
    ctx.lineTo(40, 10);
    ctx.bezierCurveTo(56, 14, 56, 40, 32, 56);
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
}
