/**
 * 樱町计划 (SakuraBlock) - Three.js 场景渲染与交互主入口 (src/main.js)
 * 技术基线：PerspectiveCamera FOV 28°, ACESFilmicToneMapping 曝光 1.18, PCFShadowMap, FogExp2
 * 支持三种机位：正前 45° RPG视角、等距 45° (58,48,58)、全景鸟瞰 (88,72,88)
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SakuraSimulation, PERSONALITY_CONFIG, OUTFIT_CONFIG, BUILDABLE_TEMPLATES } from './simulation.js';
import { TextureFactory } from './textures.js';
import { AssetBuilder } from './builder.js';
import { AssetLibrary, resolveShopStyle } from './assets.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SakuraGameApp {
  constructor() {
    this.sim = new SakuraSimulation();
    window.sim = this.sim; // 暴露至 window.sim 供控制台调参验证

    this.canvas = document.getElementById('game-canvas');
    this.emissiveMaterials = [];
    this.animatedProps = [];
    this.builder = new AssetBuilder(this.emissiveMaterials, this.animatedProps);
    this.assets = new AssetLibrary(this.emissiveMaterials);
    this.useGLB = false;

    this.shopMeshes = new Map();
    this.lotMeshes = new Map();
    this.issueMeshes = new Map();
    this.sakuraTrees = [];
    this.npcs = [];
    this.vehicles = [];
    this.territoryTiles = [];
    this.nightLights = [];
    this.showTerritoryOverlay = false;

    this.cameraMode = 'third'; // 'panoramic' | 'third' | 'free'
    this.camYaw = Math.PI;      // 第三人称的镜头朝向，只由鼠标改，不跟角色瞬转
    this.camPitch = 0.38;       // 俯角
    this.camDist = 12;          // 相机到角色的距离
    this.timePresetOverride = null; // null(自动随时间) | 'afternoon' | 'sunset' | 'night'

    this.keys = {};
    this.playerPos = new THREE.Vector3(12, 0, 5.8);
    this.playerTargetPos = null;
    this.nearbyAction = null;

    this.clock = new THREE.Clock();

    this.initRenderer();
    this.initLights();
    this.bindEvents();
    this.applyCameraMode('third');
  }

  async init() {
    this.useGLB = await this.assets.init();
    this.buildCrossroadsDistrict();
    this.initWeatherParticles();
    this.initPlayerAndNPCs();
    this.initVehicles();
    this.initNightLights();
    this.refreshAllHUD();
    this.applyCameraMode(this.cameraMode);
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
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xb3baad, roughness: 0.92 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.01;
    ground.receiveShadow = true;
    ground.name = 'walkable_ground';
    this.scene.add(ground);
    this.walkableMeshes = [ground];

    // 地块底座。自由视角会转到侧面，只铺一张平面会露出悬空的薄片边。
    // 上面一道浅色压边，下面沉色台体，远看像城市模型摆在一块石台上。
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(129.6, 0.9, 129.6),
      new THREE.MeshStandardMaterial({ color: 0xb2b7bc, roughness: 0.95 })
    );
    rim.position.y = -0.44;
    rim.receiveShadow = true;
    this.scene.add(rim);

    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(129.6, 4.2, 129.6),
      new THREE.MeshStandardMaterial({ color: 0x7f858c, roughness: 0.96 })
    );
    plinth.position.y = -3.0;
    this.scene.add(plinth);

    // 2. 人行道砖面铺装，带粗糙度与法线，不再是一块平色
    const swTex = TextureFactory.createSidewalkTexture();
    const swMat = new THREE.MeshStandardMaterial({
      map: swTex,
      roughnessMap: TextureFactory.createSidewalkRoughnessMap(),
      normalMap: TextureFactory.createSidewalkNormalMap(),
      normalScale: new THREE.Vector2(0.25, 0.25),
      roughness: 1.0,
      metalness: 0.02
    });
    this.sidewalkMat = swMat;
    const swH = new THREE.Mesh(new THREE.BoxGeometry(108, 0.14, 19), swMat);
    swH.position.set(0, 0.07, 0);
    swH.receiveShadow = true;
    const swV = new THREE.Mesh(new THREE.BoxGeometry(19, 0.14, 108), swMat);
    swV.position.set(0, 0.07, 0);
    swV.receiveShadow = true;
    this.scene.add(swH, swV);

    // 3. 东西向与南北向 10m 宽柏油车行道。贴图只做沥青，标线另铺几何
    const asphaltMap = TextureFactory.createAsphaltTexture();
    const asphaltRough = TextureFactory.createAsphaltRoughnessMap();
    const asphaltNormal = TextureFactory.createAsphaltNormalMap();

    this.roadMatH = new THREE.MeshStandardMaterial({
      map: asphaltMap,
      roughnessMap: asphaltRough,
      normalMap: asphaltNormal,
      normalScale: new THREE.Vector2(0.22, 0.22),
      roughness: 1.0,
      metalness: 0.03
    });

    const mapV = asphaltMap.clone();
    mapV.repeat.set(2, 16);
    mapV.needsUpdate = true;
    this.roadMatV = new THREE.MeshStandardMaterial({
      map: mapV,
      roughnessMap: asphaltRough,
      normalMap: asphaltNormal,
      normalScale: new THREE.Vector2(0.22, 0.22),
      roughness: 1.0,
      metalness: 0.03
    });

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
    this.crossMat = new THREE.MeshStandardMaterial({
      map: crossTex,
      roughnessMap: asphaltRough,
      normalMap: asphaltNormal,
      normalScale: new THREE.Vector2(0.2, 0.2),
      roughness: 0.95,
      metalness: 0.03
    });
    const crossing = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), this.crossMat);
    crossing.rotation.x = -Math.PI / 2;
    crossing.position.y = 0.165;
    crossing.receiveShadow = true;
    this.scene.add(crossing);

    this.buildRoadMarkings();

    // 4. 建造 16 家日式商铺（Blender 导出的 12 套门脸）
    this.sim.shops.forEach(shop => {
      const mesh = this.createShopMesh(shop);
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
      const key = cfg.floors >= 3 ? `res_danchi_${cfg.floors}f` : 'res_machiya_2f';
      const mesh = this.assets.instance(key);
      if (mesh) {
        mesh.position.set(cfg.x, 0, cfg.z);
        mesh.rotation.y = cfg.rotY || 0;
        if (cfg.floors >= 3) mesh.scale.set(cfg.w / 9.4, 1, cfg.d / 6.8);
        this.scene.add(mesh);
      } else {
        this.scene.add(this.builder.createResidenceBuilding(cfg));
      }
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

    // 11. 沿街铺街道家具与电线
    this.dressStreet();
  }

  /**
   * 按店铺数据取一套 GLB 门脸并摆到街区里。
   * 同一套门脸会服务多家店，店名由 decorateShop 现贴，所以换店、加层都不影响。
   */
  /**
   * 路面标线单独铺几何。贴图里画标线会被平铺拉伸，
   * 拆出来之后线宽永远准，也不用为了标线牺牲沥青的细节。
   */
  buildRoadMarkings() {
    const white = [];
    const yellow = [];

    const strip = (arr, w, d, x, z) => {
      const g = new THREE.PlaneGeometry(w, d);
      g.rotateX(-Math.PI / 2);
      g.translate(x, 0, z);
      arr.push(g);
    };

    // 中央黄虚线，路口前后各铺一段
    for (let x = -50; x <= 50; x += 7) {
      if (Math.abs(x) < 10) continue;
      strip(yellow, 3.4, 0.16, x, 0);
    }
    for (let z = -50; z <= 50; z += 7) {
      if (Math.abs(z) < 10) continue;
      strip(yellow, 0.16, 3.4, 0, z);
    }

    // 两侧白实线
    for (const side of [-1, 1]) {
      for (const sgn of [-1, 1]) {
        strip(white, 47, 0.14, sgn * 30.5, side * 4.35);
        strip(white, 0.14, 47, side * 4.35, sgn * 30.5);
      }
    }

    // 路口前的停止线
    for (const sgn of [-1, 1]) {
      strip(white, 0.42, 8.6, sgn * 8.2, 0);
      strip(white, 8.6, 0.42, 0, sgn * 8.2);
    }

    const bake = (geos, color) => {
      if (!geos.length) return;
      const merged = mergeGeometries(geos, false);
      geos.forEach(g => g.dispose());
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.82,
        metalness: 0.0,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      });
      const mesh = new THREE.Mesh(merged, mat);
      mesh.position.y = 0.172;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    };
    bake(white, 0xe8eaec);
    bake(yellow, 0xd8a63a);
  }

  /**
   * 沿街铺日式街道家具：电线杆与电线、路灯、路镜、邮筒、消防栓、
   * 防撞柱、护栏、止まれ标志、信号灯、车架、垃圾桶、井盖、交通锥。
   *
   * 全部静态，所以摆完之后按材质烘焙成一整批，几十件道具只占十来个 draw call。
   */
  dressStreet() {
    const staged = [];
    const add = (key, x, z, rotY = 0, scale = 1) => staged.push({ key, x, z, rotY, scale });

    // 电线杆，沿四条人行道排，避开路口
    const lines = [[], [], [], []];
    for (let x = -46; x <= 46; x += 12) {
      if (Math.abs(x) < 12) continue;
      add('prop_pole', x, 7.7, Math.PI / 2);
      add('prop_pole', x, -7.7, -Math.PI / 2);
      lines[0].push(new THREE.Vector3(x, 0, 7.7));
      lines[1].push(new THREE.Vector3(x, 0, -7.7));
    }
    for (let z = -46; z <= 46; z += 12) {
      if (Math.abs(z) < 12) continue;
      add('prop_pole', 7.7, z, Math.PI);
      add('prop_pole', -7.7, z, 0);
      lines[2].push(new THREE.Vector3(7.7, 0, z));
      lines[3].push(new THREE.Vector3(-7.7, 0, z));
    }

    // 路灯，间隔比电杆大一倍，错开位置
    for (let x = -40; x <= 40; x += 24) {
      if (Math.abs(x) < 14) continue;
      add('prop_lamp', x, 6.3, Math.PI / 2);
      add('prop_lamp', x, -6.3, -Math.PI / 2);
    }
    for (let z = -40; z <= 40; z += 24) {
      if (Math.abs(z) < 14) continue;
      add('prop_lamp', 6.3, z, Math.PI);
      add('prop_lamp', -6.3, z, 0);
    }

    // 四个街角的路镜
    add('prop_mirror', 11.4, 8.6, -Math.PI * 0.75);
    add('prop_mirror', -11.4, -8.6, Math.PI * 0.25);
    add('prop_mirror', 11.4, -8.6, Math.PI * 0.75);
    add('prop_mirror', -11.4, 8.6, -Math.PI * 0.25);

    // 邮筒、消防栓、垃圾桶、自行车架、贩卖机
    add('prop_mailbox', 9.8, 9.0, 0);
    add('prop_hydrant', -17.2, 8.6, 0);
    add('prop_hydrant', 28.4, -8.6, 0);
    add('prop_trash', -26.0, 8.8, Math.PI);
    add('prop_trash', 26.0, -8.8, 0);
    add('prop_bikerack', 31.0, 8.9, 0);
    add('prop_bikerack', -31.0, -8.9, Math.PI);
    add('prop_vending', 15.8, 9.0, Math.PI);
    add('prop_vending', -15.8, -9.0, 0);

    // 斑马线两端的防撞柱
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          add('prop_bollard', sx * (8.6 + i * 1.8), sz * 5.6, 0);
        }
      }
    }

    // 人行道护栏
    for (let i = 0; i < 4; i++) {
      add('prop_guardrail', 10.8 + i * 2.0, 5.9, 0);
      add('prop_guardrail', -10.8 - i * 2.0, -5.9, 0);
      add('prop_guardrail', 5.9, -10.8 - i * 2.0, Math.PI / 2);
    }

    // 止まれ 与信号灯
    add('prop_stop', 17.2, 5.3, Math.PI);
    add('prop_stop', -17.2, -5.3, 0);
    add('prop_signal', 9.6, 9.4, Math.PI / 2);
    add('prop_signal', -9.6, -9.4, -Math.PI / 2);

    // 交通锥与井盖
    add('prop_cone', 44.4, 6.3, 0);
    add('prop_cone', 45.8, 7.0, 0);
    add('prop_cone', -44.4, -6.3, 0);
    add('prop_manhole', -24, 1.9, 0);
    add('prop_manhole', 24, -1.9, 0);
    add('prop_manhole', 1.9, -24, 0);
    add('prop_manhole', -1.9, 24, 0);

    // 摆好位置后统一烘焙
    const buckets = new Map();
    for (const item of staged) {
      const inst = this.assets.instance(item.key);
      if (!inst) continue;
      const mtx = new THREE.Matrix4().compose(
        new THREE.Vector3(item.x, 0, item.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, item.rotY, 0)),
        new THREE.Vector3(item.scale, item.scale, item.scale)
      );
      inst.traverse(o => {
        if (!o.isMesh) return;
        const geo = o.geometry.clone();
        geo.applyMatrix4(mtx);
        const key = o.material.uuid;
        if (!buckets.has(key)) buckets.set(key, { material: o.material, geos: [] });
        buckets.get(key).geos.push(geo);
      });
    }

    const streetGroup = new THREE.Group();
    buckets.forEach(bucket => {
      const merged = bucket.geos.length === 1
        ? bucket.geos[0]
        : mergeGeometries(bucket.geos, false);
      if (!merged) return;
      if (bucket.geos.length > 1) bucket.geos.forEach(g => g.dispose());
      const mesh = new THREE.Mesh(merged, bucket.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      streetGroup.add(mesh);
    });
    this.scene.add(streetGroup);

    // 电线杆之间拉电线，全部并成一条
    const wireGeos = [];
    const addWire = (a, b, lift, lateral) => {
      const dir = new THREE.Vector3().subVectors(b, a).normalize();
      const perp = new THREE.Vector3(-dir.z, 0, dir.x);
      const p0 = a.clone().addScaledVector(perp, lateral);
      const p2 = b.clone().addScaledVector(perp, lateral);
      p0.y = lift;
      p2.y = lift;
      const mid = p0.clone().add(p2).multiplyScalar(0.5);
      mid.y -= 0.5;
      const curve = new THREE.CatmullRomCurve3([p0, mid, p2]);
      wireGeos.push(new THREE.TubeGeometry(curve, 8, 0.026, 3, false));
    };

    for (const line of lines) {
      for (let i = 0; i < line.length - 1; i++) {
        for (const lat of [-0.62, 0.62]) {
          addWire(line[i], line[i + 1], 7.2, lat);
          addWire(line[i], line[i + 1], 8.2, lat);
        }
      }
    }

    if (wireGeos.length) {
      const merged = mergeGeometries(wireGeos, false);
      wireGeos.forEach(g => g.dispose());
      const wireMat = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.9 });
      const wireMesh = new THREE.Mesh(merged, wireMat);
      wireMesh.castShadow = false;
      this.scene.add(wireMesh);
    }

    this.streetGroup = streetGroup;
  }

  createShopMesh(shop) {
    const style = resolveShopStyle(shop);
    const floors = Math.min(3, shop.floors || 2);
    const styleKey = style === 'yatai1' && floors > 1 ? 'yatai' : style;
    let mesh = this.assets.instance(`shop_${styleKey}_${floors}f`);

    if (!mesh) {
      mesh = this.builder.createShopBuilding(shop);
    } else {
      this.assets.decorateShop(mesh, shop);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: shop.moraleBoostedToday ? 0.55 : 0.0,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const halo = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.55, 32), haloMat);
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.05;
      mesh.add(halo);
      mesh.userData.haloMat = haloMat;
    }

    mesh.position.set(shop.x, 0, shop.z);
    mesh.rotation.y = shop.rotY || 0;
    mesh.userData = {
      type: 'shop',
      shopId: shop.id,
      shopData: shop,
      haloMat: mesh.userData.haloMat
    };
    return mesh;
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
    const place = (key, x, z, rotY = 0, y = 0) => {
      const mesh = this.assets.instance(key);
      if (!mesh) return null;
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotY;
      this.scene.add(mesh);
      return mesh;
    };

    // 西端朱红稻荷大鸟居，东端「桜町一番街」霓虹拱廊
    place('lm_torii', -51, 0, Math.PI / 2);
    place('lm_arch', 49, 0, Math.PI / 2);

    // 北端高架电车站：三段站体拼成一条长月台
    [-26, 0, 26].forEach(x => place('lm_station', x, -52));

    // 绿白通勤电车，沿着月台在高架上来回
    this.trainCar = place('lm_train', 0, -52, 0, 5.6);
  }

  /**
   * 领地控制度可视化：沿两条干道铺瓦片，从路口向外按半径排开。
   * 控制度上涨时，己方颜色一圈一圈往外推，玩家能直接看到扩张。
   */
  buildTerritoryOverlay() {
    this.territoryGroup = new THREE.Group();
    this.territoryGroup.visible = false;
    this.territoryTiles = [];

    const addTile = (x, z, w, d) => {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.30,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(x, 0.24, z);
      tile.userData.dist = Math.hypot(x, z);
      this.territoryGroup.add(tile);
      this.territoryTiles.push(tile);
    };

    for (let i = -10; i <= 10; i++) {
      addTile(i * 5, 0, 4.6, 17.6);   // 东西干道
      if (i !== 0) addTile(0, i * 5, 17.6, 4.6); // 南北干道
    }

    // 由近及远排序，控制度就是"从路口推出去多远"
    this.territoryTiles.sort((a, b) => a.userData.dist - b.userData.dist);
    this.territoryTiles.forEach((tile, idx) => { tile.userData.rank = idx; });

    this.scene.add(this.territoryGroup);
  }

  /**
   * 夜间街区照明：在主力店铺门前放几盏暖光点光源，
   * 让招牌的 emissive 真的能照亮地面和人，而不只是自己发亮。
   */
  initNightLights() {
    const spots = [
      [-22, -13], [-36, -13], [22, -13], [36, -13],
      [-22, 13], [36, 13], [-13, -23], [13, 23]
    ];
    spots.forEach(([x, z]) => {
      const light = new THREE.PointLight(0xffc27a, 0, 20, 2);
      light.position.set(x, 4.4, z + 3.4);
      this.scene.add(light);
      this.nightLights.push(light);
    });
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
    this.playerMesh.rotation.y = Math.PI; // 开局面朝路口
    this.scene.add(this.playerMesh);
    this.buildOutfitAccessories();
    this.applyOutfitVisual(this.sim.outfit);

    // 脚下标记，第三人称和自由视角里都能一眼找到主角在哪
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.54, 0.70, 28),
      new THREE.MeshBasicMaterial({
        color: 0xf6e2b8,
        transparent: true,
        opacity: 0.30,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(this.playerPos.x, 0.04, this.playerPos.z);
    ring.visible = false;
    this.scene.add(ring);
    this.playerMarker = ring;

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

  /**
   * 四套换装的实体配件。以前只改上衣颜色，看不出换了什么；
   * 现在每套都有一件真挂件，柴犬装还有耳朵和尾巴。
   */
  buildOutfitAccessories() {
    const p = this.playerMesh;

    const bag = new THREE.Group();
    const bagBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.26, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x3b2418, roughness: 0.6 })
    );
    bagBody.position.set(0.52, 0.78, 0.12);
    bag.add(bagBody);
    p.add(bag);

    const headband = new THREE.Mesh(
      new THREE.TorusGeometry(0.40, 0.05, 6, 16),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.75 })
    );
    headband.rotation.x = Math.PI / 2;
    headband.position.set(0, 1.54, 0);
    p.add(headband);

    const shiba = new THREE.Group();
    const furMat = new THREE.MeshStandardMaterial({ color: 0xe69a45, roughness: 0.85 });
    [-1, 1].forEach(s => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 4), furMat);
      ear.position.set(s * 0.19, 1.80, 0);
      ear.rotation.z = s * 0.18;
      shiba.add(ear);
    });
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 10, Math.PI), furMat);
    tail.position.set(0, 0.94, -0.34);
    tail.rotation.y = Math.PI / 2;
    shiba.add(tail);
    p.add(shiba);

    const apron = new THREE.Group();
    const cloth = new THREE.Mesh(
      new THREE.BoxGeometry(0.50, 0.52, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.92 })
    );
    cloth.position.set(0, 0.94, 0.33);
    apron.add(cloth);
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.09, 0.30),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 })
    );
    belt.position.set(0, 0.72, 0.18);
    apron.add(belt);
    p.add(apron);

    p.userData.accessories = { suit: bag, happi: headband, shiba, artisan: apron };
  }

  applyOutfitVisual(key) {
    const acc = this.playerMesh?.userData?.accessories;
    if (!acc) return;
    Object.entries(acc).forEach(([name, obj]) => {
      obj.visible = name === key;
    });
  }

  initVehicles() {
    const specs = [
      { type: 'keitruck', axis: 'x', laneZ: -2.4, dir: 1, pos: -35, speed: 9.5 },
      { type: 'taxi', axis: 'x', laneZ: 2.4, dir: -1, pos: 28, speed: 11.0 },
      { type: 'bus', axis: 'z', laneX: -2.4, dir: 1, pos: -40, speed: 8.2 },
      { type: 'taxi', axis: 'z', laneX: 2.4, dir: -1, pos: 32, speed: 10.5 }
    ];
    specs.forEach(sp => {
      const mesh = this.assets.instance(`veh_${sp.type}`) || this.builder.createJapaneseVehicleMesh(sp.type);
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

  /**
   * 三档机位。全景固定俯瞰，第三人称吊在角色身后，
   * 自由视角是编辑器式的轨道相机，主角不动，绕场景中心转。
   */
  applyCameraMode(mode) {
    this.cameraMode = mode;
    document.querySelectorAll('[data-cam-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.camMode === mode);
    });

    const hint = document.getElementById('cam-hint');

    if (mode === 'panoramic') {
      this.controls.enabled = false;
      this.camera.fov = 30;
      this.camera.updateProjectionMatrix();
      this.camera.position.set(88, 72, 88);
      this.camera.lookAt(0, 4, 0);
      if (hint) hint.style.display = 'none';
    } else if (mode === 'third') {
      this.controls.enabled = false;
      this.camera.fov = 48;
      this.camera.updateProjectionMatrix();
      // 第一次进来，镜头摆在角色正后方
      if (this.playerMesh && !this._camPlaced) {
        this.camYaw = this.playerMesh.rotation.y;
        this._camPlaced = true;
      }
      this.updateThirdPersonCamera(true, 0);
      if (hint) {
        hint.textContent = 'WASD 走动 · 右键拖动转视角 · 滚轮拉远近';
        hint.style.display = 'block';
      }
    } else if (mode === 'free') {
      // 右键旋转、左键平移、滚轮缩放，和目标点都不绑角色
      this.controls.enabled = true;
      this.controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE
      };
      this.controls.minDistance = 8;
      this.controls.maxDistance = 220;
      this.controls.target.set(0, 3, 0);
      this.camera.fov = 42;
      this.camera.updateProjectionMatrix();
      this.camera.position.set(72, 54, 72);
      this.controls.update();
      if (hint) {
        hint.textContent = '右键旋转 · 左键平移 · 滚轮缩放';
        hint.style.display = 'block';
      }
    }
    this.controls.update();
  }

  /**
   * 在全景或自由视角按方向键，主角不会动，容易让人以为坏了。
   * 弹一句说明，顺手把第三人称那颗按钮闪一下。
   */
  nudgeWalkHint() {
    const now = performance.now();
    if (now - (this._walkHintAt || 0) < 2600) return;
    this._walkHintAt = now;
    this.showToast('观赏视角下主角不动，切到「第三人称」才能走动');
    const btn = document.querySelector('[data-cam-mode="third"]');
    if (btn) {
      btn.classList.add('nudge');
      setTimeout(() => btn.classList.remove('nudge'), 1400);
    }
  }

  /**
   * 第三人称跟拍。机位挂在角色上方一圈球面上，朝向由 camYaw 决定，
   * 不跟角色转身，所以按 A/D 时画面不会甩。位置做指数平滑，跟得稳但不拖。
   */
  updateThirdPersonCamera(snap, dt) {
    if (!this.playerMesh) return;
    const look = new THREE.Vector3(this.playerPos.x, 1.9, this.playerPos.z);
    const hd = this.camDist * Math.cos(this.camPitch);
    const vy = this.camDist * Math.sin(this.camPitch);
    const wanted = new THREE.Vector3(
      look.x - Math.sin(this.camYaw) * hd,
      look.y + vy,
      look.z - Math.cos(this.camYaw) * hd
    );

    if (snap || dt === 0) {
      this.camera.position.copy(wanted);
    } else {
      const k = 1 - Math.pow(0.0008, dt);
      this.camera.position.lerp(wanted, Math.min(1, k));
    }
    this.camera.lookAt(look);
  }

  /** 角色转向做插值，别一帧拧过去。 */
  faceToward(targetYaw, dt) {
    let delta = targetYaw - this.playerMesh.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    this.playerMesh.rotation.y += delta * Math.min(1, dt * 14);
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

    // 柏油路面湿润镜面反射切换。
    // 干燥时 roughness 必须给 1.0，让粗糙度贴图说了算；
    // 之前写死 0.72 把贴图乘掉，路面一直是塑料反光。
    const roadRoughness = isRain ? 0.34 : 1.0;
    const roadMetalness = isRain ? 0.05 : 0.02;
    this.roadMatH.roughness = roadRoughness;
    this.roadMatV.roughness = roadRoughness;
    this.crossMat.roughness = isRain ? 0.42 : 1.0;
    this.roadMatH.metalness = roadMetalness;
    this.roadMatV.metalness = roadMetalness;
    this.crossMat.metalness = roadMetalness;

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
    let sunIntensity = 1.60;
    let hemiIntensity = 0.80;
    let ambientIntensity = 0.40;
    let isNightLight = false;

    if (preset === 'night' || weather === 'night_rain') {
      bgHex = 0x0b1220;
      sunHex = 0x6f8fc4;
      sunIntensity = 0.32;
      hemiIntensity = 0.26;
      ambientIntensity = 0.10;
      isNightLight = true;
    } else if (preset === 'sunset') {
      bgHex = 0xfdba74;
      sunHex = 0xf97316;
      sunIntensity = 1.25;
      hemiIntensity = 0.58;
      ambientIntensity = 0.28;
      isNightLight = true;
    } else if (weather === 'rain') {
      bgHex = 0x94a3b8;
      sunHex = 0xcbd5e1;
      sunIntensity = 0.85;
      hemiIntensity = 0.62;
      ambientIntensity = 0.32;
    } else if (weather === 'sakura') {
      bgHex = 0xfce7f3;
      sunHex = 0xfff1f2;
      sunIntensity = 1.72;
      hemiIntensity = 0.85;
      ambientIntensity = 0.42;
    }

    this.scene.background.lerp(new THREE.Color(bgHex), 0.08);
    this.scene.fog.color.copy(this.scene.background);
    this.dirLight.color.lerp(new THREE.Color(sunHex), 0.08);
    this.dirLight.intensity = THREE.MathUtils.lerp(this.dirLight.intensity, sunIntensity, 0.08);
    this.hemiLight.intensity = THREE.MathUtils.lerp(this.hemiLight.intensity, hemiIntensity, 0.08);
    this.ambientLight.intensity = THREE.MathUtils.lerp(
      this.ambientLight.intensity, ambientIntensity, 0.08);

    // 夜间招牌与红灯笼自发光增强
    this.emissiveMaterials.forEach(mat => {
      const target = isNightLight ? mat.userData.nightIntensity : mat.userData.baseIntensity;
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, target, 0.1);
    });

    // 夜间店门前暖光点光源，白天收掉
    const lampTarget = isNightLight ? 1.7 : 0;
    this.nightLights.forEach(light => {
      light.intensity = THREE.MathUtils.lerp(light.intensity, lampTarget, 0.06);
    });
  }

  update(dt) {
    // 1. 推进模拟内核
    const minuteChanged = this.sim.tick(dt);
    if (minuteChanged) {
      this.refreshAllHUD();
    }

    // 2. 玩家移动 (WASD / 方向键 / 点击寻路)
    // 以镜头朝向为基准，WASD 相对镜头走
    const fwd = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const right = new THREE.Vector3(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
    const moveVec = new THREE.Vector3();
    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveVec.add(fwd);
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveVec.sub(fwd);
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveVec.add(right);
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveVec.sub(right);

    // 全景和自由视角都是看场景的，主角站住；第三人称才能走动
    const frozen = this.cameraMode !== 'third';
    const wantsMove = moveVec.lengthSq() > 0;
    if (frozen && wantsMove) this.nudgeWalkHint();

    let isMoving = false;
    const moveSpeed = 10.5;

    if (!frozen && wantsMove) {
      this.playerTargetPos = null;
      moveVec.normalize();
      this.playerPos.addScaledVector(moveVec, moveSpeed * dt);
      this.faceToward(Math.atan2(moveVec.x, moveVec.z), dt);
      isMoving = true;
    } else if (!frozen && this.playerTargetPos) {
      const diff = new THREE.Vector3().subVectors(this.playerTargetPos, this.playerPos);
      diff.y = 0;
      if (diff.length() > 0.35) {
        diff.normalize();
        this.playerPos.addScaledVector(diff, moveSpeed * dt);
        this.faceToward(Math.atan2(diff.x, diff.z), dt);
        isMoving = true;
      } else {
        this.playerTargetPos = null;
      }
    }

    this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x, -48, 48);
    this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z, -48, 48);
    this.playerMesh.position.copy(this.playerPos);

    if (this.playerMarker) {
      this.playerMarker.position.set(this.playerPos.x, 0.04, this.playerPos.z);
      this.playerMarker.visible = this.cameraMode !== 'panoramic';
    }

    // 主角四肢行走摆动
    const pData = this.playerMesh.userData;
    if (isMoving) {
      pData.walkPhase += dt * 12;
      pData.leftLeg.rotation.x = Math.sin(pData.walkPhase) * 0.55;
      pData.rightLeg.rotation.x = -Math.sin(pData.walkPhase) * 0.55;
      pData.leftArm.rotation.x = -Math.sin(pData.walkPhase) * 0.45;
      pData.rightArm.rotation.x = Math.sin(pData.walkPhase) * 0.45;
    } else {
      pData.leftLeg.rotation.x = 0;
      pData.rightLeg.rotation.x = 0;
    }

    if (this.cameraMode === 'third') {
      this.updateThirdPersonCamera(false, dt);
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
    if (this.controls.enabled) this.controls.update();
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
        this.showToast(`发现街道隐患 · ${issue.title}，按 E 可亲手排除`);
        this.refreshAllHUD();
      }
      if (d < minDist) {
        minDist = d;
        closest = { type: 'issue', data: issue, label: `按 E 亲手排除隐患 · ${issue.title}` };
      }
    });

    // 检查商铺门前足迹士气与巡视互动
    this.sim.shops.forEach(shop => {
      const d = Math.hypot(this.playerPos.x - shop.x, this.playerPos.z - shop.z);
      if (d <= 7.0 && !shop.moraleBoostedToday) {
        if (this.sim.triggerFootstepMorale(shop.id)) {
          const mesh = this.shopMeshes.get(shop.id);
          if (mesh?.userData?.haloMat) mesh.userData.haloMat.opacity = 0.55;
          this.showToast(`走过 ${shop.name} 门前，店员士气提振，今日客流 +10%`);
          this.refreshAllHUD();
        }
      }
      if (d < minDist) {
        minDist = d;
        closest = { type: 'shop', data: shop, label: `按 E 亲自巡视 ${shop.name} · 店长 ${shop.boss}` };
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
    setTxt('hud-population', `${snap.households}户 ${snap.population}人`);
    setTxt('hud-satisfaction', `${snap.satisfaction}%`);
    setTxt('hud-quota', `${snap.patrolQuotaLeft} / ${this.sim.patrolQuotaMax}`);
    setTxt('hud-control', `${Math.round(snap.control * 100)}%`);

    // 刷新领地渗透图层：己方颜色从路口往外推，推多远由控制度决定
    const playerTilesCount = Math.round(snap.control * this.territoryTiles.length);
    this.territoryTiles.forEach(tile => {
      const own = tile.userData.rank < playerTilesCount;
      tile.material.color.setHex(own ? 0xf43f5e : 0x06b6d4);
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
            <span class="badge">${s.floors}F · 好感 ${s.affinity}</span>
          </div>
          <div class="card-sub">${s.boss} · ${s.hours} · 今日 ¥${s.todayRevenue.toLocaleString()}</div>
          <div class="card-actions">
            <button class="btn" onclick="window.gameApp.handlePatrol('${s.id}', true)" ${s.patrolledToday ? 'disabled' : ''}>
              ${s.patrolledToday ? '今日已巡视' : '亲自巡视'}
            </button>
            <button class="btn" onclick="window.gameApp.handleProposal('${s.id}')" ${s.proposalDone ? 'disabled' : ''}>
              ${s.proposalDone ? '提案已落地' : `提案 ¥${s.proposalCost.toLocaleString()}`}
            </button>
            <button class="btn" onclick="window.gameApp.handleUpgradeFloor('${s.id}')" ${s.floors >= 3 ? 'disabled' : ''}>
              ${s.floors >= 3 ? '已满三层' : '加建一层'}
            </button>
          </div>
        </div>
      `).join('');
    }

    // 2. 隐患列表
    const issueListEl = document.getElementById('issue-list-container');
    if (issueListEl) {
      issueListEl.innerHTML = this.sim.issues.map(iss => `
        <div class="card-item">
          <div class="card-head">
            <strong>${iss.discovered ? iss.title : '未揭示的街角隐患'}</strong>
            <span class="badge">${iss.resolved ? '已解决' : (iss.discovered ? '待处理' : '未发现')}</span>
          </div>
          <div class="card-sub">${iss.discovered ? iss.desc : '走到八米半以内才会显形'}</div>
          ${!iss.resolved ? `
            <div class="card-actions">
              <button class="btn btn-tone" onclick="window.gameApp.handleResolveIssue('${iss.id}', true)">亲手处理</button>
              <button class="btn" onclick="window.gameApp.handleResolveIssue('${iss.id}', false)">店长代办</button>
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
      const newMesh = this.createShopMesh(res.shop);
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
    this.applyOutfitVisual(outfitKey);
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

    // 方向键和 E 要拦掉默认行为，否则输入法在中文态时会把按键吃掉
    const MOVE_CODES = new Set([
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyE'
    ]);

    window.addEventListener('keydown', e => {
      const code = e.code || ('Key' + String(e.key || '').toUpperCase());
      this.keys[code] = true;
      if (MOVE_CODES.has(code)) e.preventDefault();
      if (code === 'KeyE' && !e.repeat) this.triggerNearbyInteraction();
    });

    window.addEventListener('keyup', e => {
      const code = e.code || ('Key' + String(e.key || '').toUpperCase());
      this.keys[code] = false;
    });

    // 切走窗口时按键状态会卡住，回来还在走，清一下
    window.addEventListener('blur', () => { this.keys = {}; });

    // 中文输入法会把 WASD 当成拼音吃掉，提示一下
    document.addEventListener('compositionstart', () => {
      this.showToast('输入法在中文状态，按 Shift 切到英文才能用 WASD 走');
    });

    const canvas = this.renderer.domElement;
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    let camDragging = false;
    let dragX = 0;
    let dragY = 0;

    // 第三人称：右键拖拽转镜头，滚轮拉远近
    canvas.addEventListener('pointerdown', e => {
      if (this.cameraMode === 'third' && e.button === 2) {
        camDragging = true;
        dragX = e.clientX;
        dragY = e.clientY;
        canvas.setPointerCapture?.(e.pointerId);
      }
    });

    canvas.addEventListener('pointermove', e => {
      if (!camDragging) return;
      const dx = e.clientX - dragX;
      const dy = e.clientY - dragY;
      dragX = e.clientX;
      dragY = e.clientY;
      this.camYaw -= dx * 0.006;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.004, 0.10, 1.05);
    });

    canvas.addEventListener('pointerup', e => {
      if (!camDragging) return;
      camDragging = false;
      canvas.releasePointerCapture?.(e.pointerId);
    });

    canvas.addEventListener('wheel', e => {
      if (this.cameraMode !== 'third') return;
      e.preventDefault();
      this.camDist = THREE.MathUtils.clamp(this.camDist + Math.sign(e.deltaY) * 1.1, 6, 22);
    }, { passive: false });

    // 鼠标点击地面寻路或点击空地建店
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    canvas.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      if (this.cameraMode === 'free') return; // 自由视角只动镜头，不点地寻路
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
            const shopMesh = this.createShopMesh(res.shop);
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

window.addEventListener('DOMContentLoaded', async () => {
  window.gameApp = new SakuraGameApp();
  await window.gameApp.init();
});
