/**
 * 樱町计划 (SakuraBlock) - GLB 资产库 (src/assets.js)
 *
 * 模型全部来自 Blender 的 tools/blender_kit.py，导出到 public/models/。
 * 这里负责四件事：并行加载、按材质合并网格、注册夜间自发光材质、把店名贴到招牌上。
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TextureFactory } from './textures.js';

const SHOP_STYLES = [
  'konbini', 'ramen', 'izakaya', 'cafe', 'bookstore', 'sushi',
  'drugstore', 'arcade', 'machiya', 'sento', 'kappo', 'yatai'
];

// 店 id → 门脸风格。16 家店对应 12 套门脸，同风格的店靠招牌与暖帘区分。
const STYLE_BY_SHOP = {
  shop_lawson: 'konbini',
  shop_ramen: 'ramen',
  shop_izakaya: 'izakaya',
  shop_kissaten: 'cafe',
  shop_matcha: 'cafe',
  shop_bookstore: 'bookstore',
  shop_records: 'bookstore',
  shop_sushi: 'sushi',
  shop_drugstore: 'drugstore',
  shop_arcade: 'arcade',
  shop_kimono: 'machiya',
  shop_florist: 'machiya',
  shop_sento: 'sento',
  shop_kappo: 'kappo',
  shop_shokudo: 'izakaya',
  shop_takoyaki: 'yatai1'
};

// 空地新建店铺按类型挑门脸
const STYLE_BY_TEMPLATE = {
  wagashi: 'machiya',
  maidcafe: 'cafe',
  yakitori: 'izakaya'
};

export const STREET_PROPS = [
  'prop_pole', 'prop_lamp', 'prop_mailbox', 'prop_hydrant', 'prop_mirror',
  'prop_bollard', 'prop_cone', 'prop_stop', 'prop_bikerack', 'prop_trash',
  'prop_manhole', 'prop_guardrail', 'prop_vending', 'prop_signal'
];

export function resolveShopStyle(shop) {
  if (STYLE_BY_SHOP[shop.id]) return STYLE_BY_SHOP[shop.id];
  return STYLE_BY_TEMPLATE[shop.template] || STYLE_BY_TEMPLATE[shop.type] || 'konbini';
}

function manifest() {
  const keys = [];
  for (const style of SHOP_STYLES) {
    keys.push(`shop_${style}_2f`, `shop_${style}_3f`);
  }
  keys.push('shop_yatai1_1f');
  keys.push('res_danchi_3f', 'res_danchi_4f', 'res_machiya_2f');
  keys.push('lm_torii', 'lm_station', 'lm_train', 'lm_arch');
  keys.push('veh_keitruck', 'veh_taxi', 'veh_bus');
  keys.push(...STREET_PROPS);
  return keys;
}

/** 取一块带角色标记的网格的包围盒，合并前先把定位信息存下来。 */
function readMark(mesh) {
  const geo = mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  geo.boundingBox.getSize(size);
  geo.boundingBox.getCenter(center);
  return { size, center };
}

export class AssetLibrary {
  constructor(emissiveMaterials) {
    this.loader = new GLTFLoader();
    this.cache = new Map();
    this.emissiveMaterials = emissiveMaterials;
    this.ready = false;
    this.triangles = 0;
  }

  async init() {
    const keys = manifest();
    try {
      const results = await Promise.all(keys.map(key => this.loadOne(key)));
      results.forEach(item => this.cache.set(item.key, item.root));
      this.ready = true;
      return true;
    } catch (err) {
      console.warn('[SakuraBlock] GLB 资产加载失败，回退到程序化建模：', err);
      this.ready = false;
      return false;
    }
  }

  loadOne(key) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        `./models/${key}.glb`,
        gltf => {
          const root = gltf.scene;
          root.traverse(obj => {
            if (!obj.isMesh) return;
            const geo = obj.geometry;
            if (geo?.index) this.triangles += geo.index.count / 3;
            else if (geo?.attributes?.position) this.triangles += geo.attributes.position.count / 3;
          });
          this.registerEmissive(root);
          resolve({ key, root });
        },
        undefined,
        err => reject(err)
      );
    });
  }

  registerEmissive(root) {
    const seen = new Set(this.emissiveMaterials.map(m => m.uuid));
    root.traverse(obj => {
      if (!obj.isMesh) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (!mat || seen.has(mat.uuid)) continue;
        if (!mat.emissive) continue;
        const glow = mat.emissive.r + mat.emissive.g + mat.emissive.b;
        if (glow <= 0.02) continue;
        seen.add(mat.uuid);
        const base = mat.emissiveIntensity || 1;
        mat.userData = { baseIntensity: base, nightIntensity: base * 2.1 };
        this.emissiveMaterials.push(mat);
      }
    });
  }

  /**
   * 把一件资产压成「每种材质一个 mesh」。
   * Blender 出来的每件资产有几十个小物件，直接克隆会产生上百个 draw call，
   * 合并之后一间店只剩十来次绘制，才敢往街上铺道具。
   */
  flatten(root) {
    const marks = {};
    root.updateMatrixWorld(true);

    root.traverse(obj => {
      if (obj.isMesh && obj.userData?.role) {
        marks[obj.userData.role] = readMark(obj);
      }
    });

    const buckets = new Map();
    const drop = [];

    root.traverse(obj => {
      if (!obj.isMesh) return;
      if (Array.isArray(obj.material)) {
        drop.push(obj);
        return;
      }
      const geo = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
      for (const attr of Object.keys(geo.attributes)) {
        if (attr !== 'position' && attr !== 'normal') geo.deleteAttribute(attr);
      }
      if (!geo.attributes.normal) geo.computeVertexNormals();
      geo.applyMatrix4(obj.matrixWorld);
      geo.morphAttributes = {};

      const key = obj.material.uuid;
      if (!buckets.has(key)) buckets.set(key, { material: obj.material, geos: [] });
      buckets.get(key).geos.push(geo);
      drop.push(obj);
    });

    drop.forEach(obj => obj.parent?.remove(obj));

    const group = new THREE.Group();
    for (const bucket of buckets.values()) {
      const merged = bucket.geos.length === 1
        ? bucket.geos[0]
        : mergeGeometries(bucket.geos, false);
      if (!merged) {
        bucket.geos.forEach(g => group.add(new THREE.Mesh(g, bucket.material)));
        continue;
      }
      if (bucket.geos.length > 1) bucket.geos.forEach(g => g.dispose());
      const mesh = new THREE.Mesh(merged, bucket.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    group.userData = { marks };
    return group;
  }

  instance(key) {
    const src = this.cache.get(key);
    if (!src) return null;
    return this.flatten(src.clone(true));
  }

  /**
   * 给招牌贴上店名。招牌在 Blender 里打了 role=sign 的标记，
   * 合并前已经把包围盒存进 userData.marks，这里直接取用。
   */
  decorateShop(root, shop) {
    const marks = root.userData?.marks || {};
    const sign = marks.sign;
    if (!sign) return false;

    const aspect = sign.size.x / Math.max(sign.size.y, 0.01);
    const tex = TextureFactory.createShopSignTexture(
      shop.signText || shop.name,
      shop.mainColor ?? 0x16305a,
      aspect
    );
    tex.anisotropy = 4;

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: tex,
      emissiveIntensity: 0.42,
      roughness: 0.5,
      metalness: 0.05
    });
    mat.userData = { baseIntensity: 0.42, nightIntensity: 2.2 };
    this.emissiveMaterials.push(mat);

    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(sign.size.x * 0.98, sign.size.y * 0.94),
      mat
    );
    panel.position.copy(sign.center);
    panel.position.z += sign.size.z / 2 + 0.014;
    root.add(panel);

    const blade = marks.blade;
    if (blade) {
      const shortName = (shop.blade || shop.name).slice(-4);
      const btex = TextureFactory.createBladeSignTexture(shortName, 0xf0e6d2);
      btex.anisotropy = 4;
      const bmat = new THREE.MeshStandardMaterial({
        map: btex,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: btex,
        emissiveIntensity: 0.5,
        roughness: 0.55
      });
      bmat.userData = { baseIntensity: 0.5, nightIntensity: 2.4 };
      this.emissiveMaterials.push(bmat);

      const bpanel = new THREE.Mesh(
        new THREE.PlaneGeometry(blade.size.z * 0.94, blade.size.y * 0.96),
        bmat
      );
      bpanel.rotation.y = Math.PI / 2;
      bpanel.position.set(
        blade.center.x + blade.size.x / 2 + 0.012,
        blade.center.y,
        blade.center.z
      );
      root.add(bpanel);
    }
    return true;
  }
}
