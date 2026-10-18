/**
 * 樱町计划 (SakuraBlock) - 程序化贴图生成器 (src/textures.js)
 *
 * 全部用 Canvas 现画，不依赖外部图片：
 * 沥青路面、全向斑马线、人行道砖、店招、竖招、暖帘、贩卖机、Q版五官、樱花瓣。
 */

import * as THREE from 'three';

function canvasOf(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

function toTexture(canvas, { srgb = true, repeat = null } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

/** 由灰度高度图推法线贴图，给路面和砖面加微起伏。 */
function normalFromCanvas(src, strength = 2.2) {
  const size = src.width;
  const sctx = src.getContext('2d');
  const data = sctx.getImageData(0, 0, size, size).data;

  const height = new Float32Array(size * size);
  for (let i = 0; i < height.length; i++) {
    height[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255;
  }

  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];

  const out = canvasOf(size, size);
  const octx = out.getContext('2d');
  const img = octx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x - 1, y) - at(x + 1, y)) * strength;
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

export class TextureFactory {
  /** 可平铺沥青。刻意不带标线，标线另做几何，免得跟着贴图一起拉伸。 */
  static createAsphaltCanvas(size = 512) {
    const canvas = canvasOf(size, size);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#45484e';
    ctx.fillRect(0, 0, size, size);

    // 大块补丁，路面不会是均匀一片
    for (let i = 0; i < 26; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const pr = 20 + Math.random() * 90;
      const shade = Math.random() > 0.5 ? 255 : 0;
      ctx.fillStyle = `rgba(${shade},${shade},${shade},${0.012 + Math.random() * 0.022})`;
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * (0.5 + Math.random()), Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // 骨料颗粒
    for (let i = 0; i < 14000; i++) {
      const g = 62 + Math.random() * 96;
      ctx.fillStyle = `rgba(${g},${g + 2},${g + 6},${0.10 + Math.random() * 0.22})`;
      const s = Math.random() < 0.85 ? 1 : 2;
      ctx.fillRect(Math.random() * size, Math.random() * size, s, s);
    }

    // 细裂纹
    ctx.strokeStyle = 'rgba(18,19,22,0.35)';
    for (let i = 0; i < 12; i++) {
      ctx.lineWidth = 0.6 + Math.random();
      ctx.beginPath();
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.moveTo(x, y);
      const steps = 4 + Math.floor(Math.random() * 5);
      for (let k = 0; k < steps; k++) {
        x += (Math.random() - 0.5) * 60;
        y += (Math.random() - 0.5) * 60;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 油渍
    for (let i = 0; i < 7; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const r = 8 + Math.random() * 26;
      const grd = ctx.createRadialGradient(px, py, 0, px, py, r);
      grd.addColorStop(0, 'rgba(12,13,16,0.22)');
      grd.addColorStop(1, 'rgba(12,13,16,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return canvas;
  }

  static createAsphaltTexture() {
    return toTexture(this.createAsphaltCanvas(), { repeat: [16, 2] });
  }

  static createAsphaltRoughnessMap() {
    const src = this.createAsphaltCanvas(256);
    const ctx = src.getContext('2d');
    const img = ctx.getImageData(0, 0, 256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = img.data[i];
      // 亮的地方更粗糙，压到 0.62 到 0.95 之间
      const rough = 150 + (v - 58) * 0.30 + Math.random() * 12;
      const g = Math.max(158, Math.min(242, rough));
      img.data[i] = g;
      img.data[i + 1] = g;
      img.data[i + 2] = g;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(src);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 2);
    return tex;
  }

  static createAsphaltNormalMap() {
    const src = this.createAsphaltCanvas(256);
    const tex = new THREE.CanvasTexture(normalFromCanvas(src, 0.55));
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 2);
    return tex;
  }

  static createScrambleCrossingTexture() {
    const canvas = canvasOf(1024, 1024);
    const ctx = canvas.getContext('2d');

    const base = this.createAsphaltCanvas(1024);
    ctx.drawImage(base, 0, 0);

    ctx.fillStyle = 'rgba(238,241,244,0.90)';
    for (let i = 128; i <= 872; i += 56) {
      ctx.fillRect(i, 40, 32, 140);
      ctx.fillRect(i, 844, 32, 140);
      ctx.fillRect(40, i, 140, 32);
      ctx.fillRect(844, i, 140, 32);
    }

    // 涩谷风对角斑马线
    ctx.save();
    ctx.translate(512, 512);
    for (const angle of [Math.PI / 4, -Math.PI / 4]) {
      ctx.save();
      ctx.rotate(angle);
      for (let i = -360; i <= 360; i += 54) {
        ctx.fillRect(i, -52, 26, 104);
      }
      ctx.restore();
    }
    ctx.restore();

    // 车轮压出来的脏痕
    ctx.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 40; i++) {
      const px = Math.random() * 1024;
      const py = Math.random() * 1024;
      const r = 10 + Math.random() * 40;
      const grd = ctx.createRadialGradient(px, py, 0, px, py, r);
      grd.addColorStop(0, 'rgba(120,122,126,1)');
      grd.addColorStop(1, 'rgba(255,255,255,1)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    return toTexture(canvas);
  }

  static createSidewalkCanvas(size = 512) {
    const canvas = canvasOf(size, size);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#b8b1a4';
    ctx.fillRect(0, 0, size, size);

    const tile = size / 4;
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        const shade = 174 + Math.floor(Math.random() * 26);
        ctx.fillStyle = `rgb(${shade},${shade - 5},${shade - 14})`;
        ctx.fillRect(tx * tile + 2, ty * tile + 2, tile - 4, tile - 4);

        for (let i = 0; i < 60; i++) {
          const g = 150 + Math.random() * 70;
          ctx.fillStyle = `rgba(${g},${g - 4},${g - 12},0.25)`;
          ctx.fillRect(tx * tile + 2 + Math.random() * (tile - 6),
            ty * tile + 2 + Math.random() * (tile - 6), 2, 2);
        }
      }
    }

    ctx.strokeStyle = 'rgba(118,111,100,0.65)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * tile, 0); ctx.lineTo(i * tile, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * tile); ctx.lineTo(size, i * tile); ctx.stroke();
    }
    return canvas;
  }

  static createSidewalkTexture() {
    return toTexture(this.createSidewalkCanvas(), { repeat: [24, 24] });
  }

  static createSidewalkRoughnessMap() {
    const src = this.createSidewalkCanvas(256);
    const ctx = src.getContext('2d');
    const img = ctx.getImageData(0, 0, 256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = img.data[i];
      const rough = 150 + (255 - v) * 0.35 + Math.random() * 10;
      const g = Math.max(140, Math.min(238, rough));
      img.data[i] = g;
      img.data[i + 1] = g;
      img.data[i + 2] = g;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(src);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(24, 24);
    return tex;
  }

  static createSidewalkNormalMap() {
    const src = this.createSidewalkCanvas(256);
    const tex = new THREE.CanvasTexture(normalFromCanvas(src, 0.7));
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(24, 24);
    return tex;
  }

  /**
   * 店面主招牌。aspect 是招牌面板的宽高比，文字按比例自适应，
   * 不会再被拉成扁的。
   */
  static createShopSignTexture(text, bgColorHex = 0x16305a, aspect = 7.0) {
    const width = 1024;
    const height = Math.max(96, Math.min(384, Math.round(width / Math.max(aspect, 1))));
    const canvas = canvasOf(width, height);
    const ctx = canvas.getContext('2d');

    const base = '#' + (bgColorHex >>> 0).toString(16).padStart(6, '0');

    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const grd = ctx.createLinearGradient(0, 0, 0, height);
    grd.addColorStop(0, 'rgba(255,255,255,0.16)');
    grd.addColorStop(0.52, 'rgba(255,255,255,0.02)');
    grd.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);

    // 内描边
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = Math.max(2, height * 0.035);
    ctx.strokeRect(ctx.lineWidth, ctx.lineWidth,
      width - ctx.lineWidth * 2, height - ctx.lineWidth * 2);

    // 左侧色条
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(width * 0.035, height * 0.22, width * 0.008, height * 0.56);

    // 文字自适应
    const maxTextWidth = width * 0.80;
    let fontSize = height * 0.56;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let guard = 0; guard < 24; guard++) {
      ctx.font = `900 ${fontSize}px "Hiragino Sans", "Yu Gothic", "Microsoft YaHei", sans-serif`;
      if (ctx.measureText(text).width <= maxTextWidth) break;
      fontSize *= 0.9;
    }

    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = height * 0.06;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, width * 0.53, height * 0.53);
    ctx.shadowBlur = 0;

    return toTexture(canvas);
  }

  /** 侧挂竖招。竖排逐字画，字距按高度均分。 */
  static createBladeSignTexture(text, bgColorHex = 0xffffff) {
    const width = 256;
    const height = 768;
    const canvas = canvasOf(width, height);
    const ctx = canvas.getContext('2d');

    const base = '#' + (bgColorHex >>> 0).toString(16).padStart(6, '0');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const grd = ctx.createLinearGradient(0, 0, width, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0.22)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(0,0,0,0.30)';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, width - 8, height - 8);

    const chars = Array.from(text);
    const slot = (height - 90) / Math.max(chars.length, 1);
    const size = Math.min(slot * 0.78, width * 0.62);
    ctx.font = `900 ${size}px "Hiragino Sans", "Yu Gothic", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1b1b1b';

    chars.forEach((ch, i) => {
      ctx.fillText(ch, width / 2, 45 + slot * (i + 0.5));
    });

    return toTexture(canvas);
  }

  /** 旧接口保留，内部转给新的招牌绘制。 */
  static createSignboardTexture(text, bgColorHex = 0x1e3a8a) {
    return this.createShopSignTexture(text, bgColorHex, 3.2);
  }

  static createNorenTexture(text, bgColorHex = 0x991b1b) {
    const canvas = canvasOf(256, 128);
    const ctx = canvas.getContext('2d');

    const hexStr = '#' + (bgColorHex >>> 0).toString(16).padStart(6, '0');
    ctx.fillStyle = hexStr;
    ctx.fillRect(0, 0, 256, 128);

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

    return toTexture(canvas);
  }

  static createVendingMachineTexture(brandColor = '#0284c7') {
    const canvas = canvasOf(128, 256);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = brandColor;
    ctx.fillRect(0, 0, 128, 256);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(10, 16, 108, 128);

    const canColors = ['#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899', '#a855f7'];
    for (let r = 0; r < 3; r++) {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(14, 48 + r * 38, 100, 6);
      for (let c = 0; c < 5; c++) {
        ctx.fillStyle = canColors[(r * 5 + c) % canColors.length];
        ctx.fillRect(18 + c * 19, 24 + r * 38, 13, 22);
      }
    }

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(82, 154, 32, 28);
    ctx.fillRect(16, 196, 96, 42);

    return toTexture(canvas);
  }

  static createChibiFaceTexture(eyeColor = '#1e293b') {
    const canvas = canvasOf(128, 128);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffe4d6';
    ctx.fillRect(0, 0, 128, 128);

    ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
    ctx.beginPath(); ctx.arc(30, 78, 12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(98, 78, 12, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = eyeColor;
    ctx.beginPath(); ctx.ellipse(38, 62, 9, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(90, 62, 9, 12, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(35, 57, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(87, 57, 3.5, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(64, 78, 9, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    return toTexture(canvas);
  }

  static createSakuraPetalTexture() {
    const canvas = canvasOf(64, 64);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fbcfe8';
    ctx.beginPath();
    ctx.moveTo(32, 56);
    ctx.bezierCurveTo(8, 40, 8, 14, 24, 10);
    ctx.lineTo(32, 20);
    ctx.lineTo(40, 10);
    ctx.bezierCurveTo(56, 14, 56, 40, 32, 56);
    ctx.fill();
    return toTexture(canvas);
  }
}
