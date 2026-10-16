/**
 * 樱町计划 (SakuraBlock) - 3D 资产与场景构建器 (src/builder.js)
 * 负责程序化构建：多层日式商铺、团地与町屋居民楼、横丁灯笼小巷、高架车站、神社鸟居、车辆与Q版角色。
 */
import * as THREE from 'three';
import { TextureFactory } from './textures.js';
import { OUTFIT_CONFIG } from './simulation.js';

export class AssetBuilder {
  constructor(emissiveMaterials, animatedProps) {
    this.emissiveMaterials = emissiveMaterials; // 夜间自发光材质集合
    this.animatedProps = animatedProps;         // 空调风扇等动态部件集合
  }

  registerEmissive(mat, baseIntensity = 0.25, nightIntensity = 2.2) {
    mat.userData = { baseIntensity, nightIntensity };
    this.emissiveMaterials.push(mat);
    return mat;
  }

  /**
   * 创建精细化多层日式商铺 (石砌基座 + 木梁框架 + 垂木重檐瓦顶 + 暖帘 + 室内暖光收银台 + 2F阳台 + 旋转空调外机)
   */
  createShopBuilding(shopData) {
    const group = new THREE.Group();
    group.position.set(shopData.x, 0, shopData.z);
    group.rotation.y = shopData.rotY || 0;
    group.userData = { type: 'shop', shopId: shopData.id, shopData };

    const floors = shopData.floors || 2;
    const width = 7.4;
    const depth = 6.8;
    const floorH = 3.2;
    const totalH = floors * floorH;

    // 1. 石砌基座
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(width + 0.3, 0.32, depth + 0.3), baseMat);
    baseMesh.position.y = 0.16;
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    group.add(baseMesh);

    // 2. 主体墙面
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfbf7f0, roughness: 0.72 });
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(width, totalH, depth), wallMat);
    bodyMesh.position.y = 0.32 + totalH / 2;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // 3. 外露日式木造梁柱框架
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
    const cornerOffsets = [
      [-width / 2, -depth / 2], [width / 2, -depth / 2],
      [-width / 2, depth / 2], [width / 2, depth / 2]
    ];
    cornerOffsets.forEach(([cx, cz]) => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.24, totalH, 0.24), woodMat);
      pillar.position.set(cx, 0.32 + totalH / 2, cz);
      pillar.castShadow = true;
      group.add(pillar);
    });

    for (let f = 1; f <= floors; f++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(width + 0.18, 0.22, depth + 0.18), woodMat);
      beam.position.y = 0.32 + f * floorH;
      group.add(beam);
    }

    // 4. 一楼暖光透明橱窗与室内收银台
    const glassMat = this.registerEmissive(
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: new THREE.Color(0xfbbf24),
        emissiveIntensity: 0.45,
        roughness: 0.2
      }),
      0.35, 1.85
    );
    const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(width * 0.44, 2.0, 0.12), glassMat);
    windowMesh.position.set(-width * 0.2, 1.45, depth / 2 + 0.02);
    group.add(windowMesh);

    // 推拉木格门
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.25, 0.14), woodMat);
    doorMesh.position.set(width * 0.22, 1.44, depth / 2 + 0.02);
    group.add(doorMesh);

    // 5. 条纹出挑雨棚
    const awningMat = new THREE.MeshStandardMaterial({ color: shopData.awningColor || 0xef4444, roughness: 0.6 });
    const awning = new THREE.Mesh(new THREE.BoxGeometry(width * 0.94, 0.22, 1.35), awningMat);
    awning.position.set(0, 2.95, depth / 2 + 0.58);
    awning.rotation.x = 0.22;
    awning.castShadow = true;
    group.add(awning);

    // 6. 分片日式暖帘 (暖簾)
    const norenTex = TextureFactory.createNorenTexture(shopData.norenText || '営業中', shopData.mainColor);
    const norenMat = new THREE.MeshStandardMaterial({ map: norenTex, side: THREE.DoubleSide, transparent: true });
    const norenMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.88), norenMat);
    norenMesh.position.set(width * 0.22, 2.28, depth / 2 + 0.42);
    group.add(norenMesh);

    // 7. 发光主店招 + 侧向悬挑袖看板
    const signTex = TextureFactory.createSignboardTexture(shopData.signText || shopData.name, shopData.mainColor);
    const signMat = this.registerEmissive(
      new THREE.MeshStandardMaterial({
        map: signTex,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: signTex,
        emissiveIntensity: 0.35
      }),
      0.3, 1.6
    );
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 1.05, 0.26), signMat);
    signBoard.position.set(0, 3.65, depth / 2 + 0.18);
    signBoard.castShadow = true;
    group.add(signBoard);

    // 袖看板 (侧向立式灯箱)
    const sideSignMat = this.registerEmissive(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: new THREE.Color(shopData.awningColor || 0xf43f5e),
        emissiveIntensity: 0.5
      }),
      0.3, 2.0
    );
    const sideSign = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.4, 0.78), sideSignMat);
    sideSign.position.set(width / 2 + 0.42, totalH - 1.0, depth / 2 - 0.5);
    group.add(sideSign);

    // 8. 二楼日式木阳台与窗台花箱
    if (floors >= 2) {
      const balcony = new THREE.Mesh(new THREE.BoxGeometry(width * 0.76, 0.75, 0.65), woodMat);
      balcony.position.set(0, 0.32 + floorH + 0.4, depth / 2 + 0.3);
      group.add(balcony);

      const upperWin = new THREE.Mesh(new THREE.BoxGeometry(width * 0.6, 1.35, 0.1), glassMat);
      upperWin.position.set(0, 0.32 + floorH + 1.45, depth / 2 + 0.02);
      group.add(upperWin);
    }

    // 9. 屋顶结构（和式重檐瓦顶 / 平顶高架水塔）
    const roofY = 0.32 + totalH;
    if (shopData.roofType === 'kawara' || shopData.roofType === 'gabled') {
      const kawaraMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.65, metalness: 0.15 });
      const eave = new THREE.Mesh(new THREE.BoxGeometry(width + 1.1, 0.28, depth + 1.1), kawaraMat);
      eave.position.y = roofY + 0.14;
      eave.castShadow = true;
      group.add(eave);

      const upperRoof = new THREE.Mesh(new THREE.ConeGeometry(width * 0.68, 1.85, 4), kawaraMat);
      upperRoof.position.y = roofY + 1.05;
      upperRoof.rotation.y = Math.PI / 4;
      upperRoof.scale.set(1.12, 1, 0.95);
      upperRoof.castShadow = true;
      group.add(upperRoof);

      // 金色鬼瓦脊饰
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.7, roughness: 0.2 });
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(width * 0.55, 0.22, 0.22), goldMat);
      ridge.position.y = roofY + 1.82;
      group.add(ridge);
    } else {
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(width + 0.3, 0.45, depth + 0.3), baseMat);
      parapet.position.y = roofY + 0.22;
      group.add(parapet);

      // 屋顶储水塔
      const tankMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.3 });
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.3, 12), tankMat);
      tank.position.set(-width * 0.24, roofY + 0.95, -depth * 0.2);
      tank.castShadow = true;
      group.add(tank);
    }

    // 10. 侧面带旋转风扇的空调外机
    const acGroup = this.createACUnit();
    acGroup.position.set(width / 2 + 0.22, 2.6, 0);
    group.add(acGroup);

    // 11. 门口外摆道具（自动贩卖机、红灯笼、清酒樽、自行车）
    this.addShopExteriorProps(group, shopData, width, depth);

    // 12. 足迹士气光环（触发后显形）
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: shopData.moraleBoostedToday ? 0.55 : 0.0,
      side: THREE.DoubleSide
    });
    const haloRing = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.55, 32), haloMat);
    haloRing.rotation.x = -Math.PI / 2;
    haloRing.position.y = 0.04;
    group.add(haloRing);
    group.userData.haloMat = haloMat;

    return group;
  }

  createACUnit() {
    const g = new THREE.Group();
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.62, 0.82), boxMat);
    g.add(body);

    const fanBlade = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.42, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    fanBlade.position.set(0.2, 0, 0);
    g.add(fanBlade);
    this.animatedProps.push({ mesh: fanBlade, axis: 'x', speed: 8.5 });
    return g;
  }

  addShopExteriorProps(group, shopData, width, depth) {
    const frontZ = depth / 2 + 0.85;

    // 左侧自动贩卖机
    const vmTex = TextureFactory.createVendingMachineTexture(
      shopData.category === 'night' ? '#b91c1c' : '#0284c7'
    );
    const vmMat = this.registerEmissive(
      new THREE.MeshStandardMaterial({
        map: vmTex,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: vmTex,
        emissiveIntensity: 0.35
      }),
      0.25, 1.45
    );
    const vmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.95, 0.72), vmMat);
    vmMesh.position.set(-width / 2 + 0.65, 1.1, frontZ);
    vmMesh.castShadow = true;
    group.add(vmMesh);

    // 挂门前发光红提灯
    const lanternColor = shopData.category === 'night' ? 0xef4444 : 0xf97316;
    const lanternMat = this.registerEmissive(
      new THREE.MeshStandardMaterial({
        color: lanternColor,
        emissive: new THREE.Color(lanternColor),
        emissiveIntensity: 0.65
      }),
      0.4, 2.4
    );
    [-1.2, 1.2].forEach(lx => {
      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.56, 12), lanternMat);
      lantern.position.set(lx, 2.48, depth / 2 + 0.78);
      group.add(lantern);
    });

    // 右侧停放通勤自行车
    const bike = this.createBicycleMesh(shopData.awningColor || 0x38bdf8);
    bike.position.set(width / 2 - 0.5, 0, frontZ + 0.35);
    bike.rotation.y = 0.35;
    group.add(bike);
  }

  createBicycleMesh(frameColor = 0x38bdf8) {
    const g = new THREE.Group();
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const frameMat = new THREE.MeshStandardMaterial({ color: frameColor, metalness: 0.4, roughness: 0.4 });

    const w1 = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 8, 16), wheelMat);
    w1.position.set(-0.45, 0.35, 0);
    const w2 = w1.clone();
    w2.position.set(0.45, 0.35, 0);
    g.add(w1, w2);

    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), frameMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.52, 0);
    g.add(bar);

    const basket = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.24, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x78350f })
    );
    basket.position.set(0.46, 0.78, 0);
    g.add(basket);
    return g;
  }

  /**
   * 创建日式多层居民楼（团地 Danchi & 传统町屋 Machiya）
   */
  createResidenceBuilding(cfg) {
    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);
    group.rotation.y = cfg.rotY || 0;

    const w = cfg.w || 8.5;
    const d = cfg.d || 6.5;
    const floors = cfg.floors || 3;
    const h = floors * 2.9;

    const wallMat = new THREE.MeshStandardMaterial({ color: cfg.color || 0xf1f5f9, roughness: 0.78 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.68, 1.6, 4), roofMat);
    roof.position.y = h + 0.8;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.1, 1, 0.88);
    roof.castShadow = true;
    group.add(roof);

    // 居民楼多层阳台与温暖窗户灯光
    const winMat = this.registerEmissive(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: new THREE.Color(0xf59e0b),
        emissiveIntensity: 0.3
      }),
      0.2, 1.65
    );
    const railMat = new THREE.MeshStandardMaterial({ color: 0x64748b });

    for (let f = 0; f < floors; f++) {
      const wy = 1.45 + f * 2.9;
      for (let wx = -w * 0.3; wx <= w * 0.3; wx += w * 0.3) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.1, 0.1), winMat);
        win.position.set(wx, wy, d / 2 + 0.03);
        group.add(win);
      }
      if (f >= 1) {
        const balcony = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.68, 0.55), railMat);
        balcony.position.set(0, wy - 0.45, d / 2 + 0.25);
        group.add(balcony);
      }
    }

    return group;
  }

  /**
   * 创建二次元 Q 版角色（主角或市民 NPC），含五官贴图、四肢摆动关节、手持物与雨天自动撑开的雨伞
   */
  createChibiCharacter(options = {}) {
    const group = new THREE.Group();
    const isPlayer = !!options.isPlayer;
    const outfit = OUTFIT_CONFIG[options.outfit || 'suit'] || OUTFIT_CONFIG.suit;
    const bodyColor = isPlayer ? outfit.primaryColor : (options.coatColor || 0x3b82f6);
    const hairColor = options.hairColor || (isPlayer ? 0x1e293b : 0x451a03);

    // 双腿关节
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.52, 8), legMat);
    leftLeg.position.set(-0.14, 0.26, 0);
    const rightLeg = leftLeg.clone();
    rightLeg.position.set(0.14, 0.26, 0);
    group.add(leftLeg, rightLeg);

    // 躯干服饰
    const torsoMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.72, 12), torsoMat);
    torso.position.y = 0.82;
    torso.castShadow = true;
    group.add(torso);

    // 头部与二次元面部贴图
    const faceTex = TextureFactory.createChibiFaceTexture();
    const headMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.5 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), headMat);
    head.position.y = 1.46;
    head.rotation.y = -Math.PI / 2;
    head.castShadow = true;
    group.add(head);

    // 头发与刘海
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.65 });
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
    hairCap.position.y = 1.5;
    group.add(hairCap);

    // 双臂
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.48, 8), torsoMat);
    leftArm.position.set(-0.36, 0.85, 0);
    const rightArm = leftArm.clone();
    rightArm.position.set(0.36, 0.85, 0);
    group.add(leftArm, rightArm);

    // 雨天自动显形的半透明和伞/雨伞
    const umbrellaGroup = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 1.25, 6),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
    );
    shaft.position.set(0.32, 1.45, 0.1);
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(0.85, 0.38, 12),
      new THREE.MeshStandardMaterial({
        color: isPlayer ? 0xf43f5e : 0x38bdf8,
        transparent: true,
        opacity: 0.88
      })
    );
    canopy.position.set(0.32, 2.05, 0.1);
    umbrellaGroup.add(shaft, canopy);
    umbrellaGroup.visible = false;
    group.add(umbrellaGroup);

    group.userData = {
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      torso,
      torsoMat,
      umbrellaGroup,
      walkPhase: Math.random() * Math.PI * 2
    };

    return group;
  }

  /**
   * 创建日式树池樱花树（可随季节切换春樱/秋枫/黄金银杏）
   */
  createSakuraTree(x, z, scale = 1.0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);

    // 树池石围栏
    const planter = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.26, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 })
    );
    planter.position.y = 0.13;
    group.add(planter);

    // 主树干与分枝
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.9 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.5, 8), trunkMat);
    trunk.position.y = 1.35;
    trunk.castShadow = true;
    group.add(trunk);

    // 多团簇樱花树冠
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.65 });
    const crownClusters = [
      [0, 3.1, 0, 1.15],
      [-0.65, 2.75, 0.45, 0.82],
      [0.68, 2.8, -0.4, 0.85],
      [0.35, 3.45, 0.48, 0.78],
      [-0.45, 3.35, -0.45, 0.75]
    ];
    const crownMeshes = [];
    crownClusters.forEach(([cx, cy, cz, r]) => {
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), foliageMat);
      puff.position.set(cx, cy, cz);
      puff.castShadow = true;
      group.add(puff);
      crownMeshes.push(puff);
    });

    group.userData = { foliageMat, crownMeshes };
    return group;
  }

  /**
   * 创建日本街头动态车辆（白色轻卡 Kei Truck / 东京绿黄出租车 / 粉白社区巴士）
   */
  createJapaneseVehicleMesh(vType = 'keitruck') {
    const g = new THREE.Group();
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });

    if (vType === 'taxi') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 1.1, 1.8),
        new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.35 })
      );
      body.position.y = 0.75;
      body.castShadow = true;
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 0.85, 1.62),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3 })
      );
      cabin.position.set(-0.1, 1.62, 0);
      g.add(body, cabin);
    } else if (vType === 'bus') {
      const busBody = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 2.35, 2.2),
        new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 })
      );
      busBody.position.y = 1.45;
      busBody.castShadow = true;
      g.add(busBody);
    } else {
      // 日本白色轻卡 (軽トラ)
      const cab = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 1.65, 1.75),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
      );
      cab.position.set(1.05, 1.05, 0);
      cab.castShadow = true;
      const bed = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.55, 1.75),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0 })
      );
      bed.position.set(-0.75, 0.65, 0);
      g.add(cab, bed);
    }

    [[-1.2, -0.88], [1.2, -0.88], [-1.2, 0.88], [1.2, 0.88]].forEach(([wx, wz]) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 12), wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.36, wz);
      g.add(wheel);
    });

    return g;
  }
}
