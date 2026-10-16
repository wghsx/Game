/**
 * 樱町计划 (SakuraBlock) - Three.js 场景渲染与交互主入口 (src/main.js)
 * 技术基线：PerspectiveCamera FOV 28°, ACESFilmicToneMapping 曝光 1.18, PCFShadowMap, FogExp2
 * 支持三种机位：正前 45° RPG视角、等距 45° (58,48,58)、全景鸟瞰 (88,72,88)
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SakuraSimulation, PERSONALITY_CONFIG, OUTFIT_CONFIG, BUILDABLE_TEMPLATES } from './simulation.js';
import { TextureFactory } from './textures.js';
import { AssetBuilder } from './builder.js';

export class SakuraGameApp {
  constructor() {
    this.sim = new SakuraSimulation();
    window.sim = this.sim; // 暴露至 window.sim 供控制台调参验证

    this.canvas = document.getElementById('game-canvas');
    this.emissiveMaterials = [];
    this.animatedProps = [];
    this.builder = new AssetBuilder(this.emissiveMaterials, this.animatedProps);

    this.shopMeshes = new Map();
    this.lotMeshes = new Map();
    this.issueMeshes = new Map();
    this.sakuraTrees = [];
    this.npcs = [];
    this.vehicles = [];
    this.territoryTiles = [];
    this.showTerritoryOverlay = false;

    this.cameraMode = 'rpg'; // 'rpg' | 'iso' | 'panoramic'
    this.timePresetOverride = null; // null(自动随时间) | 'afternoon' | 'sunset' | 'night'

    this.keys = {};
    this.playerPos = new THREE.Vector3(0, 0, 8);
    this.playerTargetPos = null;
    this.nearbyAction = null;

    this.clock = new THREE.Clock();

    this.initRenderer();
    this.initLights();
    this.buildCrossroadsDistrict();
    this.initWeatherParticles();
    this.initPlayerAndNPCs();
    this.initVehicles();
    this.bindEvents();
    this.applyCameraMode('rpg');
    this.refreshAllHUD();

    this.animate();
  }

  initRenderer() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdceaf6);
    this.scene.fog = new THREE.FogExp2(0xdceaf6, 0.0022);

    this.camera = new THREE.PerspectiveCamera(
      28,
      window.innerWidth / window.innerHeight,
      0.5,
      350
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      preserveDrawingBuffer: true // 支持一键导出实机渲染PNG截图
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 16;
    this.controls.maxDistance = 165;
  }

  initLights() {
    this.hemiLight = new THREE.HemisphereLight(0xfff5eb, 0x94a3b8, 0.85);
    this.scene.add(this.hemiLight);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
    this.dirLight.position.set(42, 68, 38);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    const d = 64;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);
  }

  buildCrossroadsDistrict() {
    // 1. 108m x 108m 城市基底与绿化草坪
    const groundGeo = new THREE.PlaneGeometry(130, 130);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.88 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'walkable_ground';
    this.scene.add(ground);
    this.walkableMeshes = [ground];

    // 2. 人行道砖面铺装
    const swTex = TextureFactory.createSidewalkTexture();
    const swMat = new THREE.MeshStandardMaterial({ map: swTex, roughness: 0.8 });
    const swH = new THREE.Mesh(new THREE.BoxGeometry(108, 0.14, 19), swMat);
    swH.position.set(0, 0.07, 0);
    swH.receiveShadow = true;
    const swV = new THREE.Mesh(new THREE.BoxGeometry(19, 0.14, 108), swMat);
    swV.position.set(0, 0.07, 0);
    swV.receiveShadow = true;
    this.scene.add(swH, swV);

    // 3. 东西向与南北向 10m 宽柏油车行道 + 中央 14m×14m 涩谷风全向斑马线
    const roadTexH = TextureFactory.createRoadTexture(false);
    const roadTexV = TextureFactory.createRoadTexture(true);
    this.roadMatH = new THREE.MeshStandardMaterial({ map: roadTexH, roughness: 0.72, metalness: 0.08 });
    this.roadMatV = new THREE.MeshStandardMaterial({ map: roadTexV, roughness: 0.72, metalness: 0.08 });

    const roadH = new THREE.Mesh(new THREE.PlaneGeometry(108, 10), this.roadMatH);
    roadH.rotation.x = -Math.PI / 2;
    roadH.position.y = 0.15;
    roadH.receiveShadow = true;
    const roadV = new THREE.Mesh(new THREE.PlaneGeometry(10, 108), this.roadMatV);
    roadV.rotation.x = -Math.PI / 2;
    roadV.position.y = 0.155;
    roadV.receiveShadow = true;
    this.scene.add(roadH, roadV);

    const crossTex = TextureFactory.createScrambleCrossingTexture();
    this.crossMat = new THREE.MeshStandardMaterial({ map: crossTex, roughness: 0.68, metalness: 0.1 });
    const crossing = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), this.crossMat);
    crossing.rotation.x = -Math.PI / 2;
    crossing.position.y = 0.165;
    crossing.receiveShadow = true;
    this.scene.add(crossing);

    // 4. 建造 16 家精模日式商铺
    this.sim.shops.forEach(shop => {
      const mesh = this.builder.createShopBuilding(shop);
      this.scene.add(mesh);
      this.shopMeshes.set(shop.id, mesh);
    });

    // 5. 建造 4 处待开发空地浮标
    this.sim.lots.forEach(lot => {
      if (!lot.built) {
        const lotMesh = this.createBuildableLotMesh(lot);
        this.scene.add(lotMesh);
        this.lotMeshes.set(lot.id, lotMesh);
      }
    });

    // 6. 建造 12 栋日式居民楼群落（四象限后街团地 Danchi 与町屋）
    const residences = [
      { x: -24, z: -26, floors: 4, w: 9.5, d: 6.8, color: 0xf1f5f9, rotY: 0 },
      { x: -38, z: -26, floors: 3, w: 8.5, d: 6.4, color: 0xfef3c7, rotY: 0 },
      { x: -28, z: -40, floors: 4, w: 10.0, d: 7.0, color: 0xe2e8f0, rotY: 0 },
      { x: 24, z: -26, floors: 4, w: 9.5, d: 6.8, color: 0xf8fafc, rotY: 0 },
      { x: 38, z: -26, floors: 3, w: 8.5, d: 6.4, color: 0xffedd5, rotY: 0 },
      { x: 28, z: -40, floors: 4, w: 10.0, d: 7.0, color: 0xe0f2fe, rotY: 0 },
      { x: -24, z: 26, floors: 3, w: 9.0, d: 6.6, color: 0xfef2f2, rotY: Math.PI },
      { x: -38, z: 26, floors: 4, w: 9.2, d: 6.8, color: 0xf1f5f9, rotY: Math.PI },
      { x: -28, z: 40, floors: 3, w: 8.8, d: 6.5, color: 0xfef9c3, rotY: Math.PI },
      { x: 24, z: 26, floors: 4, w: 9.5, d: 6.8, color: 0xf3e8ff, rotY: Math.PI },
      { x: 38, z: 26, floors: 3, w: 8.5, d: 6.4, color: 0xf1f5f9, rotY: Math.PI },
      { x: 28, z: 40, floors: 4, w: 10.0, d: 7.0, color: 0xe2e8f0, rotY: Math.PI }
    ];
    residences.forEach(cfg => {
      this.scene.add(this.builder.createResidenceBuilding(cfg));
    });

    // 7. 沿十字大道两侧种植樱花行道树
    const treeCoords = [
      [-15, -7.8], [-29, -7.8], [-42, -7.8], [15, -7.8], [29, -7.8], [42, -7.8],
      [-15, 7.8], [-29, 7.8], [-42, 7.8], [15, 7.8], [29, 7.8], [42, 7.8],
      [-7.8, -16], [-7.8, -30], [7.8, -16], [7.8, -30],
      [-7.8, 16], [-7.8, 30], [7.8, 16], [7.8, 30]
    ];
    treeCoords.forEach(([tx, tz]) => {
      const tree = this.builder.createSakuraTree(tx, tz, 0.96 + Math.random() * 0.14);
      this.scene.add(tree);
      this.sakuraTrees.push(tree);
    });

    // 8. 地标：北端桜町高架电车站、西端稻荷神社大鸟居、东端一番街霓虹拱廊
    this.buildLandmarks();

    // 9. 构建街区争霸 3D 领地控制度渗透图层
    this.buildTerritoryOverlay();

    // 10. 构建战争迷雾隐患 3D 标记
    this.syncIssueMarkers();
  }

  createBuildableLotMesh(lot) {
    const g = new THREE.Group();
    g.position.set(lot.x, 0.16, lot.z);
    g.userData = { type: 'lot', lotId: lot.id, lotData: lot };

    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 0.18, 6.2),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.35 })
    );
    g.add(pad);

    const signTex = TextureFactory.createSignboardTexture('空地建店 ¥12,000', 0xd97706);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 1.2, 0.2),
      new THREE.MeshStandardMaterial({ map: signTex })
    );
    sign.position.y = 1.6;
    g.add(sign);
    return g;
  }

  buildLandmarks() {
    // 西端朱红神社大鸟居
    const toriiGroup = new THREE.Group();
    toriiGroup.position.set(-51, 0, 0);
    toriiGroup.rotation.y = Math.PI / 2;
    const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55 });
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 7.8, 12), redMat);
    p1.position.set(-4.2, 3.9, 0);
    const p2 = p1.clone();
    p2.position.set(4.2, 3.9, 0);
    const kasagi = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.55, 0.75), redMat);
    kasagi.position.set(0, 7.8, 0);
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.38, 0.48), redMat);
    nuki.position.set(0, 6.1, 0);
    toriiGroup.add(p1, p2, kasagi, nuki);
    this.scene.add(toriiGroup);

    // 东端「桜町一番街」霓虹拱廊
    const archGroup = new THREE.Group();
    archGroup.position.set(49, 0, 0);
    archGroup.rotation.y = Math.PI / 2;
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.3 });
    const ap1 = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 7.5, 12), pillarMat);
    ap1.position.set(-5.2, 3.75, 0);
    const ap2 = ap1.clone();
    ap2.position.set(5.2, 3.75, 0);
    const archTex = TextureFactory.createSignboardTexture('🌸 桜町一番街商店街 🌸', 0xbe185d);
    const archSignMat = this.builder.registerEmissive(
      new THREE.MeshStandardMaterial({
        map: archTex,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: archTex,
        emissiveIntensity: 0.6
      }),
      0.4, 2.2
    );
    const archBeam = new THREE.Mesh(new THREE.BoxGeometry(11.6, 1.65, 0.65), archSignMat);
    archBeam.position.set(0, 7.2, 0);
    archGroup.add(ap1, ap2, archBeam);
    this.scene.add(archGroup);

    // 北端高架电车站台与绿白通勤电车
    const stationGroup = new THREE.Group();
    stationGroup.position.set(0, 0, -52);
    const viaduct = new THREE.Mesh(
      new THREE.BoxGeometry(64, 1.2, 6.5),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 })
    );
    viaduct.position.y = 5.6;
    stationGroup.add(viaduct);

    this.trainCar = new THREE.Mesh(
      new THREE.BoxGeometry(16, 2.6, 2.9),
      new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.35 })
    );
    this.trainCar.position.set(0, 7.5, 0);
    stationGroup.add(this.trainCar);
    this.scene.add(stationGroup);
  }

  buildTerritoryOverlay() {
    this.territoryGroup = new THREE.Group();
    this.territoryGroup.visible = false;
    for (let i = -9; i <= 9; i++) {
      const matH = new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.38, side: THREE.DoubleSide });
      const tileH = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 9.2), matH);
      tileH.rotation.x = -Math.PI / 2;
      tileH.position.set(i * 5, 0.22, 0);
      tileH.userData = { index: i + 9, total: 19 };
      this.territoryGroup.add(tileH);
      this.territoryTiles.push(tileH);
    }
    this.scene.add(this.territoryGroup);
  }

  syncIssueMarkers() {
    this.issueMeshes.forEach(m => this.scene.remove(m));
    this.issueMeshes.clear();

    this.sim.issues.forEach(issue => {
      if (issue.resolved) return;
      const g = new THREE.Group();
      g.position.set(issue.x, 0.2, issue.z);
      g.userData = { type: 'issue', issueId: issue.id, issueData: issue };

      const color = issue.discovered ? 0xef4444 : 0xa855f7;
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.55, 0),
        new THREE.MeshStandardMaterial({
          color,
          emissive: new THREE.Color(color),
          emissiveIntensity: 0.9
        })
      );
      crystal.position.y = 1.6;
      g.add(crystal);
      g.userData.crystal = crystal;
      this.scene.add(g);
      this.issueMeshes.set(issue.id, g);
    });
  }

  initWeatherParticles() {
    // 1. 750片手绘樱吹雪粒子
    const sakuraCount = 750;
    const sGeo = new THREE.BufferGeometry();
    const sPos = new Float32Array(sakuraCount * 3);
    for (let i = 0; i < sakuraCount; i++) {
      sPos[i * 3] = (Math.random() - 0.5) * 110;
      sPos[i * 3 + 1] = Math.random() * 28;
      sPos[i * 3 + 2] = (Math.random() - 0.5) * 110;
    }
    sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    const sMat = new THREE.PointsMaterial({
      size: 0.52,
      map: TextureFactory.createSakuraPetalTexture(),
      transparent: true,
      alphaTest: 0.1,
      depthWrite: false
    });
    this.sakuraParticles = new THREE.Points(sGeo, sMat);
    this.scene.add(this.sakuraParticles);

    // 2. 900道 3D 动态斜雨线 (LineSegments)
    const rainCount = 900;
    const rGeo = new THREE.BufferGeometry();
    const rPos = new Float32Array(rainCount * 6);
    for (let i = 0; i < rainCount; i++) {
      const rx = (Math.random() - 0.5) * 110;
      const ry = Math.random() * 32;
      const rz = (Math.random() - 0.5) * 110;
      rPos[i * 6] = rx;
      rPos[i * 6 + 1] = ry;
      rPos[i * 6 + 2] = rz;
      rPos[i * 6 + 3] = rx - 0.35;
      rPos[i * 6 + 4] = ry - 1.65;
      rPos[i * 6 + 5] = rz;
    }
    rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
    const rMat = new THREE.LineBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.62 });
    this.rainLines = new THREE.LineSegments(rGeo, rMat);
    this.rainLines.visible = false;
    this.scene.add(this.rainLines);
  }

  initPlayerAndNPCs() {
    this.playerMesh = this.builder.createChibiCharacter({ isPlayer: true, outfit: this.sim.outfit });
    this.playerMesh.position.copy(this.playerPos);
    this.scene.add(this.playerMesh);

    const npcColors = [0x2563eb, 0xdb2777, 0x059669, 0xd97706, 0x7c3aed, 0x0891b2];
    for (let i = 0; i < 26; i++) {
      const alongX = i % 2 === 0;
      const side = (i % 4 < 2) ? -6.8 : 6.8;
      const posOffset = (Math.random() - 0.5) * 84;
      const npc = this.builder.createChibiCharacter({
        isPlayer: false,
        coatColor: npcColors[i % npcColors.length]
      });
      npc.position.set(alongX ? posOffset : side, 0, alongX ? side : posOffset);
      npc.userData.alongX = alongX;
      npc.userData.dir = Math.random() > 0.5 ? 1 : -1;
      npc.userData.speed = 2.0 + Math.random() * 1.4;
      this.scene.add(npc);
      this.npcs.push(npc);
    }
  }

  initVehicles() {
    const specs = [
      { type: 'keitruck', axis: 'x', laneZ: -2.4, dir: 1, pos: -35, speed: 9.5 },
      { type: 'taxi', axis: 'x', laneZ: 2.4, dir: -1, pos: 28, speed: 11.0 },
      { type: 'bus', axis: 'z', laneX: -2.4, dir: 1, pos: -40, speed: 8.2 },
      { type: 'taxi', axis: 'z', laneX: 2.4, dir: -1, pos: 32, speed: 10.5 }
    ];
    specs.forEach(sp => {
      const mesh = this.builder.createJapaneseVehicleMesh(sp.type);
      if (sp.axis === 'x') {
        mesh.position.set(sp.pos, 0.16, sp.laneZ);
        mesh.rotation.y = sp.dir > 0 ? 0 : Math.PI;
      } else {
        mesh.position.set(sp.laneX, 0.16, sp.pos);
        mesh.rotation.y = sp.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
      mesh.userData = sp;
      this.scene.add(mesh);
      this.vehicles.push(mesh);
    });
  }

  applyCameraMode(mode) {
    this.cameraMode = mode;
    document.querySelectorAll('[data-cam-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.camMode === mode);
    });

    if (mode === 'rpg') {
      // 宝可梦/传统日式RPG 正前方 45° 俯视跟随视角
      this.camera.position.set(this.playerPos.x, 26, this.playerPos.z + 28);
      this.controls.target.set(this.playerPos.x, 1.5, this.playerPos.z - 2);
    } else if (mode === 'iso') {
      // 《Three.js技术基线.md》规定的等距 45° (58, 48, 58)
      this.camera.position.set(this.playerPos.x + 58, 48, this.playerPos.z + 58);
      this.controls.target.copy(this.playerPos);
    } else if (mode === 'panoramic') {
      // 《Three.js技术基线.md》规定的全景机位 (88, 72, 88)
      this.camera.position.set(88, 72, 88);
      this.controls.target.set(0, 0, 0);
    }
    this.controls.update();
  }

  /**
   * 统一环境与四态天气渲染管线（解决昼夜与天气光照冲突）
   */
  updateEnvironmentVisuals(dt) {
    const weather = this.sim.weather;
    const isRain = weather === 'rain' || weather === 'night_rain';
    const isSakura = weather === 'sakura';

    this.sakuraParticles.visible = isSakura;
    this.rainLines.visible = isRain;

    // 粒子动画
    if (isSakura) {
      const pos = this.sakuraParticles.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - dt * 2.2;
        let x = pos.getX(i) + Math.sin( performance.now() * 0.001 + i ) * dt * 0.8;
        if (y < 0.2) y = 26;
        pos.setXY(i, x, y);
      }
      pos.needsUpdate = true;
    }

    if (isRain) {
      const rPos = this.rainLines.geometry.attributes.position;
      for (let i = 0; i < rPos.count; i += 2) {
        let y1 = rPos.getY(i) - dt * 28;
        if (y1 < 0) y1 = 30;
        rPos.setY(i, y1);
        rPos.setY(i + 1, y1 - 1.65);
      }
      rPos.needsUpdate = true;
    }

    // 行人与主角雨天自动撑伞
    if (this.playerMesh?.userData?.umbrellaGroup) {
      this.playerMesh.userData.umbrellaGroup.visible = isRain;
    }
    this.npcs.forEach(npc => {
      if (npc.userData?.umbrellaGroup) npc.userData.umbrellaGroup.visible = isRain;
    });

    // 柏油路面湿润镜面反射切换
    const roadRoughness = isRain ? 0.22 : 0.72;
    const roadMetalness = isRain ? 0.45 : 0.08;
    this.roadMatH.roughness = roadRoughness;
    this.roadMatV.roughness = roadRoughness;
    this.crossMat.roughness = roadRoughness;
    this.roadMatH.metalness = roadMetalness;
    this.roadMatV.metalness = roadMetalness;

    // 计算当前时段或天气强制光照
    const hour = this.sim.minute / 60;
    let preset = this.timePresetOverride;
    if (!preset) {
      if (weather === 'night_rain' || hour >= 19 || hour < 5.5) preset = 'night';
      else if (hour >= 16.5 && hour < 19) preset = 'sunset';
      else preset = 'afternoon';
    }

    let bgHex = 0xdceaf6;
    let sunHex = 0xfffbeb;
    let sunIntensity = 1.85;
    let isNightLight = false;

    if (preset === 'night' || weather === 'night_rain') {
      bgHex = 0x0f172a;
      sunHex = 0x60a5fa;
      sunIntensity = 0.42;
      isNightLight = true;
    } else if (preset === 'sunset') {
      bgHex = 0xfdba74;
      sunHex = 0xf97316;
      sunIntensity = 1.45;
      isNightLight = true;
    } else if (weather === 'rain') {
      bgHex = 0x94a3b8;
      sunHex = 0xcbd5e1;
      sunIntensity = 0.95;
    } else if (weather === 'sakura') {
      bgHex = 0xfce7f3;
      sunHex = 0xfff1f2;
      sunIntensity = 1.92;
    }

    this.scene.background.lerp(new THREE.Color(bgHex), 0.08);
    this.scene.fog.color.copy(this.scene.background);
    this.dirLight.color.lerp(new THREE.Color(sunHex), 0.08);
    this.dirLight.intensity = THREE.MathUtils.lerp(this.dirLight.intensity, sunIntensity, 0.08);

    // 夜间招牌与红灯笼自发光增强
    this.emissiveMaterials.forEach(mat => {
      const target = isNightLight ? mat.userData.nightIntensity : mat.userData.baseIntensity;
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, target, 0.1);
    });
  }

  update(dt) {
    // 1. 推进模拟内核
    const minuteChanged = this.sim.tick(dt);
    if (minuteChanged) {
      this.refreshAllHUD();
    }

    // 2. 玩家移动 (WASD / 方向键 / 点击寻路)
    const moveVec = new THREE.Vector3();
    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveVec.z -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveVec.z += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveVec.x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveVec.x += 1;

    let isMoving = false;
    const moveSpeed = 10.5;

    if (moveVec.lengthSq() > 0) {
      this.playerTargetPos = null;
      moveVec.normalize();
      this.playerPos.addScaledVector(moveVec, moveSpeed * dt);
      this.playerMesh.rotation.y = Math.atan2(moveVec.x, moveVec.z);
      isMoving = true;
    } else if (this.playerTargetPos) {
      const diff = new THREE.Vector3().subVectors(this.playerTargetPos, this.playerPos);
      diff.y = 0;
      if (diff.length() > 0.35) {
        diff.normalize();
        this.playerPos.addScaledVector(diff, moveSpeed * dt);
        this.playerMesh.rotation.y = Math.atan2(diff.x, diff.z);
        isMoving = true;
      } else {
        this.playerTargetPos = null;
      }
    }

    this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x, -48, 48);
    this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z, -48, 48);
    this.playerMesh.position.copy(this.playerPos);

    // 主角四肢行走摆动
    const pData = this.playerMesh.userData;
    if (isMoving) {
      pData.walkPhase += dt * 12;
      pData.leftLeg.rotation.x = Math.sin(pData.walkPhase) * 0.55;
      pData.rightLeg.rotation.x = -Math.sin(pData.walkPhase) * 0.55;
      pData.leftArm.rotation.x = -Math.sin(pData.walkPhase) * 0.45;
      pData.rightArm.rotation.x = Math.sin(pData.walkPhase) * 0.45;

      if (this.cameraMode === 'rpg') {
        this.camera.position.lerp(new THREE.Vector3(this.playerPos.x, 26, this.playerPos.z + 28), 0.12);
        this.controls.target.lerp(new THREE.Vector3(this.playerPos.x, 1.5, this.playerPos.z - 2), 0.12);
      }
    } else {
      pData.leftLeg.rotation.x = 0;
      pData.rightLeg.rotation.x = 0;
    }

    // 3. 检测战争迷雾隐患发现 (8.5米内显形) & 足迹士气光环 (6.5米内鼓舞)
    this.checkProximityInteractions();

    // 4. 更新市民 NPC 与动态车流
    const animSpeedMult = Math.min(2, this.sim.speed || 1);
    this.npcs.forEach(npc => {
      const u = npc.userData;
      const step = u.speed * dt * animSpeedMult * u.dir;
      if (u.alongX) {
        npc.position.x += step;
        npc.rotation.y = u.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (Math.abs(npc.position.x) > 46) u.dir *= -1;
      } else {
        npc.position.z += step;
        npc.rotation.y = u.dir > 0 ? 0 : Math.PI;
        if (Math.abs(npc.position.z) > 46) u.dir *= -1;
      }
      u.walkPhase += dt * 8 * animSpeedMult;
      u.leftLeg.rotation.x = Math.sin(u.walkPhase) * 0.45;
      u.rightLeg.rotation.x = -Math.sin(u.walkPhase) * 0.45;
    });

    this.vehicles.forEach(v => {
      const sp = v.userData;
      const delta = sp.speed * dt * animSpeedMult * sp.dir;
      if (sp.axis === 'x') {
        v.position.x += delta;
        if (v.position.x > 52) v.position.x = -52;
        if (v.position.x < -52) v.position.x = 52;
      } else {
        v.position.z += delta;
        if (v.position.z > 52) v.position.z = -52;
        if (v.position.z < -52) v.position.z = 52;
      }
    });

    // 电车穿梭与空调风扇旋转
    if (this.trainCar) {
      this.trainCar.position.x = Math.sin(performance.now() * 0.0005) * 22;
    }
    this.animatedProps.forEach(p => {
      p.mesh.rotation[p.axis] += dt * p.speed;
    });

    this.updateEnvironmentVisuals(dt);
    this.controls.update();
  }

  checkProximityInteractions() {
    let closest = null;
    let minDist = 6.2;

    // 检查隐患发现 (8.5米内自动揭开迷雾)
    this.sim.issues.forEach(issue => {
      if (issue.resolved) return;
      const d = Math.hypot(this.playerPos.x - issue.x, this.playerPos.z - issue.z);
      if (d <= 8.5 && !issue.discovered) {
        issue.discovered = true;
        const m = this.issueMeshes.get(issue.id);
        if (m?.userData?.crystal) {
          m.userData.crystal.material.color.setHex(0xef4444);
          m.userData.crystal.material.emissive.setHex(0xef4444);
        }
        this.showToast(`🔍 发现街道隐患：【${issue.title}】！按 E 键可亲手排除`);
        this.refreshAllHUD();
      }
      if (d < minDist) {
        minDist = d;
        closest = { type: 'issue', data: issue, label: `🛠️ 按 [E] 亲手排除隐患：${issue.title}` };
      }
    });

    // 检查商铺门前足迹士气与巡视互动
    this.sim.shops.forEach(shop => {
      const d = Math.hypot(this.playerPos.x - shop.x, this.playerPos.z - shop.z);
      if (d <= 7.0 && !shop.moraleBoostedToday) {
        if (this.sim.triggerFootstepMorale(shop.id)) {
          const mesh = this.shopMeshes.get(shop.id);
          if (mesh?.userData?.haloMat) mesh.userData.haloMat.opacity = 0.55;
          this.showToast(`✨ 走过「${shop.name}」，触发足迹士气鼓舞（今日客流+10%）！`);
          this.refreshAllHUD();
        }
      }
      if (d < minDist) {
        minDist = d;
        closest = { type: 'shop', data: shop, label: `🏪 按 [E] 亲自巡视「${shop.name}」(店长:${shop.boss} ♥${shop.affinity})` };
      }
    });

    this.nearbyAction = closest;
    const promptEl = document.getElementById('interact-prompt');
    if (promptEl) {
      if (closest) {
        promptEl.style.display = 'flex';
        promptEl.querySelector('.prompt-text').textContent = closest.label;
      } else {
        promptEl.style.display = 'none';
      }
    }
  }

  triggerNearbyInteraction() {
    if (!this.nearbyAction) {
      this.showToast('💡 请先走近商铺门前或街角隐患处再按 E 键互动');
      return;
    }
    if (this.nearbyAction.type === 'issue') {
      const res = this.sim.resolveIssue(this.nearbyAction.data.id, true);
      this.showToast(res.msg);
      this.syncIssueMarkers();
      this.refreshAllHUD();
    } else if (this.nearbyAction.type === 'shop') {
      const res = this.sim.patrolShop(this.nearbyAction.data.id, true);
      this.showToast(res.msg);
      this.refreshAllHUD();
    }
  }

  refreshAllHUD() {
    const snap = this.sim.snapshot();
    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt('hud-funds', `¥${snap.funds.toLocaleString()}`);
    setTxt('hud-day-time', `Day ${snap.day} · ${snap.time}`);
    setTxt('hud-level-stars', `Lv.${snap.level} ${'★'.repeat(snap.stars)}`);
    setTxt('hud-visitors', `${snap.dailyVisitors} 人/日`);
    setTxt('hud-population', `${snap.households}户 (${snap.population}人)`);
    setTxt('hud-satisfaction', `${snap.satisfaction}%`);
    setTxt('hud-quota', `${snap.patrolQuotaLeft} / ${this.sim.patrolQuotaMax}`);
    setTxt('hud-control', `${Math.round(snap.control * 100)}%`);

    // 刷新领地渗透图层颜色
    const playerTilesCount = Math.round(snap.control * this.territoryTiles.length);
    this.territoryTiles.forEach((tile, idx) => {
      tile.material.color.setHex(idx < playerTilesCount ? 0xf43f5e : 0x06b6d4);
    });

    this.renderNotebookPanels();
  }

  renderNotebookPanels() {
    // 1. 商铺与提案列表
    const shopListEl = document.getElementById('shop-list-container');
    if (shopListEl) {
      shopListEl.innerHTML = this.sim.shops.map(s => `
        <div class="card-item">
          <div class="card-head">
            <strong>${s.name}</strong>
            <span class="badge">${s.floors}F · ♥${s.affinity}</span>
          </div>
          <div class="card-sub">店长：${s.boss} | 营业：${s.hours} | 日收：¥${s.todayRevenue.toLocaleString()}</div>
          <div class="card-actions">
            <button onclick="window.gameApp.handlePatrol('${s.id}', true)" ${s.patrolledToday ? 'disabled' : ''}>
              ${s.patrolledToday ? '✅ 已巡视' : '🖐️ 亲自巡视(100%)'}
            </button>
            <button onclick="window.gameApp.handleProposal('${s.id}')" ${s.proposalDone ? 'disabled' : ''}>
              ${s.proposalDone ? '🌟 提案已落地' : `💡 提案(¥${s.proposalCost})`}
            </button>
            <button onclick="window.gameApp.handleUpgradeFloor('${s.id}')" ${s.floors >= 3 ? 'disabled' : ''}>
              🏗️ +1层
            </button>
          </div>
        </div>
      `).join('');
    }

    // 2. 主角换装与隐患列表
    const issueListEl = document.getElementById('issue-list-container');
    if (issueListEl) {
      issueListEl.innerHTML = this.sim.issues.map(iss => `
        <div class="card-item">
          <div class="card-head">
            <strong>${iss.discovered ? iss.title : '❓ 未揭示街角隐患（走近8.5m显形）'}</strong>
            <span class="badge">${iss.resolved ? '已解决' : (iss.discovered ? '待排除' : '迷雾中')}</span>
          </div>
          <div class="card-sub">${iss.discovered ? iss.desc : '需操控街区长亲自巡街经过该区域才能发现'}</div>
          ${!iss.resolved ? `
            <div class="card-actions">
              <button onclick="window.gameApp.handleResolveIssue('${iss.id}', true)">🖐️ 亲手处理(100%)</button>
              <button onclick="window.gameApp.handleResolveIssue('${iss.id}', false)">👔 店长代办(70%)</button>
            </div>
          ` : ''}
        </div>
      `).join('');
    }

    // 3. 日志列表
    const logEl = document.getElementById('sim-log-list');
    if (logEl) {
      logEl.innerHTML = this.sim.logs.slice(0, 6).map(l => `<div class="log-line">${l}</div>`).join('');
    }
  }

  handlePatrol(shopId, isManual) {
    const res = this.sim.patrolShop(shopId, isManual);
    this.showToast(res.msg);
    this.refreshAllHUD();
  }

  handleProposal(shopId) {
    const res = this.sim.proposeToShop(shopId);
    this.showToast(res.msg);
    this.refreshAllHUD();
  }

  handleUpgradeFloor(shopId) {
    const res = this.sim.upgradeShopFloor(shopId);
    this.showToast(res.msg);
    if (res.ok && res.shop) {
      const oldMesh = this.shopMeshes.get(shopId);
      if (oldMesh) this.scene.remove(oldMesh);
      const newMesh = this.builder.createShopBuilding(res.shop);
      this.scene.add(newMesh);
      this.shopMeshes.set(shopId, newMesh);
    }
    this.refreshAllHUD();
  }

  handleResolveIssue(issueId, isManual) {
    const res = this.sim.resolveIssue(issueId, isManual);
    this.showToast(res.msg);
    this.syncIssueMarkers();
    this.refreshAllHUD();
  }

  changeWeather(w) {
    this.sim.weather = w;
    this.sim.recalcDerived();
    this.refreshAllHUD();
    this.showToast(`🌦️ 天气已切换为：${w}`);
  }

  changeSeasonVegetation(season) {
    this.sim.seasonVeg = season;
    const colorMap = { sakura: 0xf9a8d4, maple: 0xef4444, ginkgo: 0xfacc15 };
    const targetHex = colorMap[season] || 0xf9a8d4;
    this.sakuraTrees.forEach(tree => {
      if (tree.userData?.foliageMat) tree.userData.foliageMat.color.setHex(targetHex);
    });
    this.showToast(`🍃 街区行道树已切换为：${season === 'sakura' ? '春樱' : (season === 'maple' ? '秋枫' : '黄金银杏')}`);
  }

  changeOutfit(outfitKey) {
    if (!OUTFIT_CONFIG[outfitKey]) return;
    this.sim.outfit = outfitKey;
    const cfg = OUTFIT_CONFIG[outfitKey];
    if (this.playerMesh?.userData?.torsoMat) {
      this.playerMesh.userData.torsoMat.color.setHex(cfg.primaryColor);
    }
    this.sim.recalcDerived();
    this.refreshAllHUD();
    this.showToast(`👘 已换装：【${cfg.name}】(${cfg.bonusDesc})`);
  }

  changePersonality(pKey) {
    if (!PERSONALITY_CONFIG[pKey]) return;
    this.sim.personality = pKey;
    this.sim.recalcDerived();
    this.refreshAllHUD();
    this.showToast(`🌸 街区性格切换为：【${PERSONALITY_CONFIG[pKey].name}】`);
  }

  toggleTerritoryOverlay() {
    this.showTerritoryOverlay = !this.showTerritoryOverlay;
    this.territoryGroup.visible = this.showTerritoryOverlay;
    this.showToast(this.showTerritoryOverlay ? '🗺️ 已开启街区争霸 3D 领地控制度渗透图层' : '🗺️ 已关闭领地渗透图层');
  }

  captureScreenshot() {
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL('image/png');
    const modal = document.getElementById('screenshot-modal');
    const img = document.getElementById('screenshot-preview-img');
    const dl = document.getElementById('screenshot-download-btn');
    if (modal && img && dl) {
      img.src = dataUrl;
      dl.href = dataUrl;
      dl.download = `SakuraBlock_Day${this.sim.day}_${Date.now()}.png`;
      modal.style.display = 'flex';
    }
  }

  showToast(text) {
    const toast = document.getElementById('game-toast');
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'KeyE') {
        this.triggerNearbyInteraction();
      }
    });

    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
    });

    // 鼠标点击地面寻路或点击空地建店
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    this.renderer.domElement.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, this.camera);

      // 检查是否点击了空地建店
      const lotObjs = Array.from(this.lotMeshes.values());
      const lotHits = raycaster.intersectObjects(lotObjs, true);
      if (lotHits.length > 0) {
        let obj = lotHits[0].object;
        while (obj && !obj.userData?.lotId) obj = obj.parent;
        if (obj?.userData?.lotId) {
          const res = this.sim.buildNewShop(obj.userData.lotId, 'wagashi');
          this.showToast(res.msg);
          if (res.ok && res.shop) {
            this.scene.remove(obj);
            this.lotMeshes.delete(obj.userData.lotId);
            const shopMesh = this.builder.createShopBuilding(res.shop);
            this.scene.add(shopMesh);
            this.shopMeshes.set(res.shop.id, shopMesh);
            this.refreshAllHUD();
          }
          return;
        }
      }

      const groundHits = raycaster.intersectObjects(this.walkableMeshes, false);
      if (groundHits.length > 0) {
        this.playerTargetPos = groundHits[0].point.clone();
      }
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(0.1, this.clock.getDelta());
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new SakuraGameApp();
});
