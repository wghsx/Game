/**
 * 樱町计划 (SakuraBlock) - 独立模拟经营内核 (src/simulation.js)
 * 职责边界：只管规则、时间推进、经济结算、街区争霸与主角配额数据，不触碰任何 Three.js 渲染对象。
 * 暴露在 window.sim，支持控制台直接调试：sim.snapshot(), sim.settle(), sim.funds = 999999 等。
 */

export const PERSONALITY_CONFIG = {
  resident: {
    id: 'resident',
    name: '🏡 居民街',
    weapon: '生活品质虹吸（住宅密集区扩张效率 +25%）',
    weights: { living: 0.40, commerce: 0.20, env: 0.30, commute: 0.10 },
    color: '#4ade80'
  },
  tourist: {
    id: 'tourist',
    name: '📸 游客街',
    weapon: '人流磁铁（十字路口与地标周边客流 +25%）',
    weights: { living: 0.20, commerce: 0.35, env: 0.25, commute: 0.20 },
    color: '#f472b6'
  },
  craft: {
    id: 'craft',
    name: '🍵 手艺街',
    weapon: '稀缺老铺溢价（传统老铺单店营业额 +25%）',
    weights: { living: 0.25, commerce: 0.30, env: 0.25, commute: 0.20 },
    color: '#fbbf24'
  },
  night: {
    id: 'night',
    name: '🏮 深夜街',
    weapon: '时差错位（18:00-04:00 夜间店铺客流 +35%）',
    weights: { living: 0.25, commerce: 0.25, env: 0.35, commute: 0.15 },
    color: '#a78bfa'
  }
};

export const OUTFIT_CONFIG = {
  suit: {
    id: 'suit',
    name: '👔 绀青街区长正装',
    item: '📖 樱町经营手账',
    bonusDesc: '全街商业提案成功率提升，居民信任度 +10%',
    primaryColor: 0x253858,
    accentColor: 0xf43f5e,
    touristBonus: 0.05
  },
  happi: {
    id: 'happi',
    name: '🏮 绯红祭典法被',
    item: '🏮 桜町御神灯',
    bonusDesc: '游客街吸引力大幅提升，全街客流 +15%',
    primaryColor: 0xd9383a,
    accentColor: 0xfbbf24,
    touristBonus: 0.15
  },
  shiba: {
    id: 'shiba',
    name: '🐕 樱花柴犬玩偶装',
    item: '🪭 招财大团扇',
    bonusDesc: '街上最醒目的吉祥物！游客街客流 +22%，市民好感加速',
    primaryColor: 0xe69a45,
    accentColor: 0xffffff,
    touristBonus: 0.22
  },
  artisan: {
    id: 'artisan',
    name: '🛠️ 职人丹宁围裙',
    item: '🧰 匠人修缮工具箱',
    bonusDesc: '亲手排除隐患奖励翻倍，全街维护费降低 20%',
    primaryColor: 0x1e40af,
    accentColor: 0xd97706,
    touristBonus: 0.08
  }
};

export const INITIAL_SHOPS = [
  // 西北象限 (NW)
  {
    id: 'shop_lawson', name: '桜町ローソン便利店', type: 'convenience', category: 'resident',
    boss: '佐藤健太', affinity: 68, level: 2, floors: 2, baseRevenue: 14500, appeal: 1.35,
    hours: '00:00 - 24:00', openStart: 0, openEnd: 24,
    x: -22, z: -13, rotY: 0, mainColor: 0x0284c7, awningColor: 0x38bdf8, roofType: 'flat',
    signText: 'LAWSON 桜町', norenText: '24H営業',
    proposalName: '导入限定樱花甜品柜', proposalCost: 6500, proposalDone: false
  },
  {
    id: 'shop_ramen', name: '一兰风·博多豚骨拉面', type: 'restaurant', category: 'night',
    boss: '高桥源治', affinity: 74, level: 2, floors: 2, baseRevenue: 16800, appeal: 1.48,
    hours: '11:00 - 03:00', openStart: 11, openEnd: 27,
    x: -36, z: -13, rotY: 0, mainColor: 0xb91c1c, awningColor: 0xef4444, roofType: 'kawara',
    signText: '博多ラーメン一桜', norenText: '豚骨らーめん',
    proposalName: '秘制辣味增叉烧配方', proposalCost: 7200, proposalDone: false
  },
  {
    id: 'shop_bookstore', name: '茑屋风·樱町文库书店', type: 'bookstore', category: 'craft',
    boss: '渡边美咲', affinity: 62, level: 2, floors: 2, baseRevenue: 13200, appeal: 1.28,
    hours: '09:00 - 22:00', openStart: 9, openEnd: 22,
    x: -13, z: -23, rotY: Math.PI / 2, mainColor: 0x1e3a5f, awningColor: 0x3b82f6, roofType: 'flat',
    signText: '桜町文庫 TSUTAYA', norenText: '古書・珈琲',
    proposalName: '二楼独立漫画绘本阅读区', proposalCost: 6800, proposalDone: false
  },
  {
    id: 'shop_kissaten', name: '昭和纯喫茶·珈琲西武', type: 'cafe', category: 'craft',
    boss: '松田龙平', affinity: 58, level: 1, floors: 2, baseRevenue: 11800, appeal: 1.24,
    hours: '08:00 - 20:00', openStart: 8, openEnd: 20,
    x: -13, z: -37, rotY: Math.PI / 2, mainColor: 0x78350f, awningColor: 0xd97706, roofType: 'gabled',
    signText: '純喫茶 珈琲西武', norenText: '自家焙煎',
    proposalName: '复刻昭和哈密瓜奶油苏打', proposalCost: 5800, proposalDone: false
  },

  // 东北象限 (NE)
  {
    id: 'shop_matcha', name: '宇治茶铺·茶寮翠泉', type: 'cafe', category: 'tourist',
    boss: '千叶凛子', affinity: 80, level: 2, floors: 2, baseRevenue: 15600, appeal: 1.42,
    hours: '08:30 - 21:00', openStart: 8, openEnd: 21,
    x: 22, z: -13, rotY: 0, mainColor: 0x15803d, awningColor: 0x22c55e, roofType: 'kawara',
    signText: '宇治茶寮 翠泉', norenText: '宇治抹茶',
    proposalName: '露天红伞抹茶芭菲茶席', proposalCost: 7000, proposalDone: false
  },
  {
    id: 'shop_sushi', name: '手打手延·筑地寿司政', type: 'restaurant', category: 'craft',
    boss: '柳泽政宗', affinity: 65, level: 2, floors: 2, baseRevenue: 18500, appeal: 1.52,
    hours: '11:00 - 23:00', openStart: 11, openEnd: 23,
    x: 36, z: -13, rotY: 0, mainColor: 0xd97706, awningColor: 0x0284c7, roofType: 'kawara',
    signText: '築地 寿司政', norenText: '江戸前鮨',
    proposalName: '清晨丰洲金枪鱼解体秀', proposalCost: 8500, proposalDone: false
  },
  {
    id: 'shop_drugstore', name: '樱町本铺·松本清药妆', type: 'convenience', category: 'tourist',
    boss: '小林麻衣', affinity: 60, level: 2, floors: 2, baseRevenue: 17200, appeal: 1.46,
    hours: '09:00 - 23:00', openStart: 9, openEnd: 23,
    x: 13, z: -23, rotY: -Math.PI / 2, mainColor: 0xeab308, awningColor: 0x2563eb, roofType: 'flat',
    signText: 'ドラッグ マツモト', norenText: '免税 TAX FREE',
    proposalName: '增设多语种免税退税专柜', proposalCost: 7500, proposalDone: false
  },
  {
    id: 'shop_kimono', name: '京都町家·花火和服馆', type: 'craft', category: 'tourist',
    boss: '西园寺绫', affinity: 72, level: 2, floors: 2, baseRevenue: 14900, appeal: 1.38,
    hours: '09:00 - 20:00', openStart: 9, openEnd: 20,
    x: 13, z: -37, rotY: -Math.PI / 2, mainColor: 0xbe185d, awningColor: 0xf472b6, roofType: 'kawara',
    signText: '京都きもの 花火', norenText: '着物レンタル',
    proposalName: '樱吹雪振袖街拍跟拍服务', proposalCost: 6900, proposalDone: false
  },

  // 西南象限 (SW)
  {
    id: 'shop_florist', name: '青山花苑·Sakura Bloom', type: 'florist', category: 'resident',
    boss: '宫崎葵', affinity: 76, level: 1, floors: 2, baseRevenue: 11200, appeal: 1.30,
    hours: '09:00 - 19:30', openStart: 9, openEnd: 20,
    x: -22, z: 13, rotY: Math.PI, mainColor: 0x0d9488, awningColor: 0x2dd4bf, roofType: 'gabled',
    signText: '青山フラワー 桜苑', norenText: '生花・盆栽',
    proposalName: '四季樱花永生花伴手礼盒', proposalCost: 5600, proposalDone: false
  },
  {
    id: 'shop_takoyaki', name: '道顿堀·大章鱼烧屋台', type: 'restaurant', category: 'night',
    boss: '冈田猛', affinity: 64, level: 1, floors: 1, baseRevenue: 12800, appeal: 1.34,
    hours: '12:00 - 02:00', openStart: 12, openEnd: 26,
    x: -36, z: 13, rotY: Math.PI, mainColor: 0xdc2626, awningColor: 0xfbbf24, roofType: 'kawara',
    signText: '大たこ焼 道頓堀', norenText: '名物たこ焼',
    proposalName: '巨型立体章鱼霓虹动态招牌', proposalCost: 6200, proposalDone: false
  },
  {
    id: 'shop_records', name: '下北泽风·黑胶唱片行', type: 'bookstore', category: 'craft',
    boss: '坂本慎太郎', affinity: 55, level: 2, floors: 2, baseRevenue: 12400, appeal: 1.26,
    hours: '11:00 - 22:00', openStart: 11, openEnd: 22,
    x: -13, z: 23, rotY: Math.PI / 2, mainColor: 0x4338ca, awningColor: 0x818cf8, roofType: 'flat',
    signText: 'CITY POP RECORDS', norenText: '中古レコード',
    proposalName: '80年代竹内玛莉亚黑胶试听会', proposalCost: 6400, proposalDone: false
  },
  {
    id: 'shop_sento', name: '樱町温泉·富士之汤钱汤', type: 'landmark', category: 'resident',
    boss: '德川源五郎', affinity: 70, level: 2, floors: 2, baseRevenue: 15800, appeal: 1.45,
    hours: '14:00 - 01:00', openStart: 14, openEnd: 25,
    x: -13, z: 37, rotY: Math.PI / 2, mainColor: 0x0369a1, awningColor: 0x38bdf8, roofType: 'kawara',
    signText: 'ゆ 富士乃湯 銭湯', norenText: '男湯 ゆ 女湯',
    proposalName: '富士山壁画翻新与冰牛奶专柜', proposalCost: 7800, proposalDone: false
  },

  // 东南象限 (SE)
  {
    id: 'shop_izakaya', name: '鸟贵族风·炭火居酒屋権八', type: 'izakaya', category: 'night',
    boss: '安藤政信', affinity: 72, level: 2, floors: 2, baseRevenue: 17600, appeal: 1.50,
    hours: '17:00 - 04:00', openStart: 17, openEnd: 28,
    x: 22, z: 13, rotY: Math.PI, mainColor: 0x991b1b, awningColor: 0xd97706, roofType: 'kawara',
    signText: '炭火焼鳥 権八', norenText: 'やきとり・酒',
    proposalName: '备长炭直火烧鸟露天席', proposalCost: 7600, proposalDone: false
  },
  {
    id: 'shop_arcade', name: '秋叶原风·GiGO樱町电玩城', type: 'arcade', category: 'night',
    boss: '星野源', affinity: 66, level: 2, floors: 2, baseRevenue: 18200, appeal: 1.54,
    hours: '10:00 - 01:00', openStart: 10, openEnd: 25,
    x: 36, z: 13, rotY: Math.PI, mainColor: 0x1d4ed8, awningColor: 0xf43f5e, roofType: 'flat',
    signText: 'GiGO GAME CENTER', norenText: 'UFOキャッチャー',
    proposalName: '限定初音未来抓娃娃机矩阵', proposalCost: 8200, proposalDone: false
  },
  {
    id: 'shop_kappo', name: '本格割烹料理·花月楼', type: 'restaurant', category: 'craft',
    boss: '藤原纪香', affinity: 69, level: 2, floors: 2, baseRevenue: 19200, appeal: 1.56,
    hours: '17:00 - 23:30', openStart: 17, openEnd: 24,
    x: 13, z: 23, rotY: -Math.PI / 2, mainColor: 0x7c2d12, awningColor: 0xf59e0b, roofType: 'kawara',
    signText: '割烹料理 花月楼', norenText: '懐石・天ぷら',
    proposalName: '京都竹林庭院包厢造景', proposalCost: 8800, proposalDone: false
  },
  {
    id: 'shop_shokudo', name: '深夜食堂·猫饭めしや', type: 'izakaya', category: 'night',
    boss: '小林薰', affinity: 82, level: 1, floors: 2, baseRevenue: 14200, appeal: 1.40,
    hours: '20:00 - 04:00', openStart: 20, openEnd: 28,
    x: 13, z: 37, rotY: -Math.PI / 2, mainColor: 0x451a03, awningColor: 0xea580c, roofType: 'kawara',
    signText: 'めしや 深夜食堂', norenText: 'めし・豚汁',
    proposalName: '暖心黄油猫饭与厚烧玉子定例', proposalCost: 6000, proposalDone: false
  }
];

export const INITIAL_LOTS = [
  { id: 'lot_nw_outer', name: '西本通·鸟居前空地', x: -46, z: -13, rotY: 0, built: false },
  { id: 'lot_ne_outer', name: '东本通·拱廊前空地', x: 46, z: -13, rotY: 0, built: false },
  { id: 'lot_sw_outer', name: '西本通·南侧街角空地', x: -46, z: 13, rotY: Math.PI, built: false },
  { id: 'lot_se_outer', name: '东本通·夜市街角空地', x: 46, z: 13, rotY: Math.PI, built: false }
];

export const BUILDABLE_TEMPLATES = {
  wagashi: {
    name: '京都老铺·鹤屋吉信和果子', type: 'craft', category: 'craft',
    boss: '五十岚鹤子', baseRevenue: 16500, appeal: 1.48,
    hours: '09:00 - 20:00', openStart: 9, openEnd: 20,
    mainColor: 0x9d174d, awningColor: 0xf472b6, roofType: 'kawara',
    signText: '京菓子 鶴屋吉信', norenText: '四季和菓子',
    proposalName: '职人现作樱饼实演橱窗', proposalCost: 7200
  },
  maidcafe: {
    name: '秋叶原风·萌系猫咪咖啡厅', type: 'cafe', category: 'tourist',
    boss: '天野莓', baseRevenue: 17400, appeal: 1.52,
    hours: '10:00 - 22:00', openStart: 10, openEnd: 22,
    mainColor: 0xdb2777, awningColor: 0xfbcfe8, roofType: 'gabled',
    signText: 'Neko Cafe 桜猫亭', norenText: '猫カフェ・甘味',
    proposalName: '三花猫店长握手会与拉花拿铁', proposalCost: 7500
  },
  yakitori: {
    name: '新桥风·赤提灯串炸横丁', type: 'izakaya', category: 'night',
    boss: '黑泽明夫', baseRevenue: 18000, appeal: 1.55,
    hours: '17:00 - 04:00', openStart: 17, openEnd: 28,
    mainColor: 0x991b1b, awningColor: 0xfbbf24, roofType: 'kawara',
    signText: '串カツ 赤ちょうちん', norenText: '二度づけ禁止',
    proposalName: '生啤买一送一工薪族狂欢夜', proposalCost: 7800
  }
};

export class SakuraSimulation {
  constructor() {
    this.seed = 20261015;
    this.day = 12;
    this.minute = 15 * 60 + 30; // 15:30 初始时刻
    this.speed = 1; // 0(暂停), 1, 2, 4
    this.funds = 128500;
    this.households = 68; // 12栋居民楼共68户
    this.population = 196;
    this.level = 16;
    this.stars = 4;

    this.weather = 'sakura'; // 'sunny' | 'sakura' | 'rain' | 'night_rain'
    this.seasonVeg = 'sakura'; // 'sakura' | 'maple' | 'ginkgo'
    this.personality = 'tourist';
    this.outfit = 'suit';

    this.patrolQuotaMax = 3;
    this.patrolQuotaLeft = 3;

    // 满意度四维 (0-100)
    this.satDimensions = {
      living: 84,
      commerce: 88,
      env: 86,
      commute: 82
    };
    this.satisfaction = 86;

    // 街区争霸状态
    this.control = 0.68; // 68% 控制度
    this.rivalName = '港町·冷蓝财阀街区';
    this.rivalControl = 0.32;
    this.highControlDays = 2;
    this.lowControlDays = 0;
    this.annexed = false;
    this.roadExtensions = 0;

    // 店铺与空地
    this.shops = JSON.parse(JSON.stringify(INITIAL_SHOPS)).map(s => ({
      ...s,
      patrolledToday: false,
      moraleBoostedToday: false,
      maintenanceWear: 0,
      todayVisitors: 0,
      todayRevenue: 0
    }));
    this.lots = JSON.parse(JSON.stringify(INITIAL_LOTS));

    // L3-1 战争迷雾隐患
    this.issues = [];
    this.spawnDailyIssues();

    this.tickAccumulator = 0;
    this.lastSettledDay = this.day;
    this.logs = [
      '🌸 欢迎来到《樱町计划 SakuraBlock》108m×108m 十字商业街！',
      '💡 操控主角走近街角紫色迷雾 ❓ 即可发现隐藏隐患，亲手处理享 100% 效果。'
    ];

    this.loadFromStorage();
    this.recalcDerived();
  }

  spawnDailyIssues() {
    const issueTemplates = [
      { type: 'sign', title: '招牌灯箱接触不良', desc: '闪烁的霓虹灯影响夜间店铺形象', x: -20, z: -9.5, shopId: 'shop_lawson' },
      { type: 'trash', title: '街角空纸箱堆积', desc: '清晨配送遗留的木箱与纸箱阻碍步道', x: 20, z: 9.5, shopId: 'shop_izakaya' },
      { type: 'complaint', title: '排队食客动线拥堵', desc: '拉面店门前食客溢出至自行车道', x: -34, z: -9.5, shopId: 'shop_ramen' },
      { type: 'sign', title: '暖帘被风吹落一角', desc: '茶寮门口暖帘挂钩松脱需加固', x: 20, z: -9.5, shopId: 'shop_matcha' }
    ];
    this.issues = issueTemplates.map((tpl, idx) => ({
      id: `issue_d${this.day}_${idx}`,
      ...tpl,
      discovered: false,
      resolved: false
    }));
  }

  getWeatherFactor() {
    if (this.weather === 'sakura') return 1.30;
    if (this.weather === 'sunny') return 1.05;
    if (this.weather === 'rain') return 0.75;
    if (this.weather === 'night_rain') return 0.90;
    return 1.0;
  }

  isShopOpen(shop) {
    const hour = Math.floor(this.minute / 60);
    if (shop.openStart === 0 && shop.openEnd === 24) return true;
    if (shop.openEnd > 24) {
      return hour >= shop.openStart || hour < (shop.openEnd - 24);
    }
    return hour >= shop.openStart && hour < shop.openEnd;
  }

  getTimeCurveFactor(shop) {
    if (!this.isShopOpen(shop)) return 0.15;
    const hour = Math.floor(this.minute / 60);
    if (shop.category === 'night') {
      return (hour >= 18 || hour < 3) ? 1.45 : 0.85;
    }
    if (shop.type === 'restaurant' || shop.type === 'cafe') {
      return (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 21) ? 1.35 : 0.95;
    }
    return 1.05;
  }

  recalcDerived() {
    const pCfg = PERSONALITY_CONFIG[this.personality] || PERSONALITY_CONFIG.tourist;
    const w = pCfg.weights;
    const unresolvedCount = this.issues.filter(i => !i.resolved).length;
    const envPenalty = unresolvedCount * 2.5;

    const envScore = Math.max(30, Math.min(100, this.satDimensions.env - envPenalty));
    this.satisfaction = Math.round(
      this.satDimensions.living * w.living +
      this.satDimensions.commerce * w.commerce +
      envScore * w.env +
      this.satDimensions.commute * w.commute
    );

    const satFactor = 0.5 + (this.satisfaction / 100) * 0.7;
    const weatherFactor = this.getWeatherFactor();
    const controlBonus = 0.8 + this.control * 0.5;
    const outfitBonus = (OUTFIT_CONFIG[this.outfit]?.touristBonus || 0) * (this.personality === 'tourist' ? 1.2 : 0.6);

    let totalVisitors = 0;
    let sameCategoryCount = 0;

    this.shops.forEach(shop => {
      if (shop.category === this.personality) sameCategoryCount++;
      const timeCurve = this.getTimeCurveFactor(shop);
      const patrolMult = shop.patrolledToday ? 1.15 : 1.0;
      const moraleMult = shop.moraleBoostedToday ? 1.10 : 1.0;
      const wearPenalty = Math.max(0.7, 1 - shop.maintenanceWear * 0.04);
      const nightRainIzakayaBonus = (this.weather === 'night_rain' && shop.category === 'night') ? 1.25 : 1.0;
      const floorMult = 1 + (shop.floors - 1) * 0.22;

      const visitors = Math.round(
        (this.households * 0.55) *
        satFactor *
        shop.appeal *
        timeCurve *
        weatherFactor *
        controlBonus *
        patrolMult *
        moraleMult *
        wearPenalty *
        nightRainIzakayaBonus *
        floorMult *
        (1 + outfitBonus)
      );
      shop.todayVisitors = visitors;
      shop.todayRevenue = Math.round(shop.baseRevenue * (visitors / 28) * (this.personality === 'craft' && shop.category === 'craft' ? 1.25 : 1.0));
      totalVisitors += visitors;
    });

    this.dailyVisitors = totalVisitors;
    const purityRatio = this.shops.length > 0 ? sameCategoryCount / this.shops.length : 0;
    this.stars = Math.min(5, Math.max(1, Math.ceil(purityRatio * 5 + 1)));
    this.level = Math.min(30, Math.floor(8 + this.shops.length * 0.5 + this.households * 0.08));
    this.population = Math.round(this.households * 2.85);
  }

  tick(realDeltaSec) {
    if (this.speed <= 0) return false;
    this.tickAccumulator += realDeltaSec * this.speed;
    let minuteChanged = false;

    while (this.tickAccumulator >= 1.0) {
      this.tickAccumulator -= 1.0;
      const prevMinute = this.minute;
      this.minute += 1;
      minuteChanged = true;

      if (this.minute >= 1440) {
        this.minute = 0;
        this.day += 1;
      }

      // 每日 04:00 日结算通道 (240 分钟)
      if (prevMinute < 240 && this.minute >= 240 && this.lastSettledDay !== this.day) {
        this.settle();
      }
    }

    if (minuteChanged) {
      this.recalcDerived();
    }
    return minuteChanged;
  }

  settle() {
    this.lastSettledDay = this.day;
    let grossCommission = 0;
    let totalRent = 0;

    this.shops.forEach(shop => {
      grossCommission += Math.round(shop.todayRevenue * 0.15);
      totalRent += 200 * shop.floors;
      if (!shop.patrolledToday) {
        shop.maintenanceWear = Math.min(5, shop.maintenanceWear + 1);
      } else {
        shop.maintenanceWear = Math.max(0, shop.maintenanceWear - 1);
      }
      shop.patrolledToday = false;
      shop.moraleBoostedToday = false;
    });

    const maintenanceDiscount = this.outfit === 'artisan' ? 0.8 : 1.0;
    const maintenanceCost = Math.round((this.shops.length * 140 + this.roadExtensions * 90) * maintenanceDiscount);
    const netIncome = grossCommission + totalRent - maintenanceCost;
    this.funds += netIncome;

    // 人口增减
    if (this.satisfaction >= 75) {
      this.households = Math.min(120, this.households + 2);
    } else if (this.satisfaction < 45) {
      this.households = Math.max(20, this.households - 2);
    }

    // 街区争霸控制度演化（单日上限 3%）
    const rawDelta = ((this.satisfaction - 62) * 0.0006) + (this.stars * 0.003) + (this.roadExtensions * 0.004) - 0.008;
    const clampedDelta = Math.max(-0.03, Math.min(0.03, rawDelta));
    this.control = Math.max(0.15, Math.min(0.98, Number((this.control + clampedDelta).toFixed(3))));
    this.rivalControl = Number((1 - this.control).toFixed(3));

    if (this.control >= 0.70) {
      this.highControlDays += 1;
      if (this.highControlDays >= 5 && !this.annexed) {
        this.annexed = true;
        this.funds += 50000;
        this.addLog('🎊 【商业兼并达成】己方控制度连续5日超70%，成功并入港町商业街！获并入奖金 ¥50,000！');
      }
    } else {
      this.highControlDays = 0;
    }

    if (this.control < 0.50) {
      this.lowControlDays += 1;
    } else {
      this.lowControlDays = 0;
    }

    this.patrolQuotaLeft = this.patrolQuotaMax;
    this.spawnDailyIssues();
    this.recalcDerived();
    this.saveToStorage();

    const sign = netIncome >= 0 ? '+' : '';
    this.addLog(`💴 【04:00 日结算】第 ${this.day} 日净收支 ${sign}¥${netIncome.toLocaleString()} (抽成¥${grossCommission.toLocaleString()} / 租金¥${totalRent.toLocaleString()})`);
    return { netIncome, grossCommission, totalRent, maintenanceCost };
  }

  patrolShop(shopId, isManual = true) {
    const shop = this.shops.find(s => s.id === shopId);
    if (!shop) return { ok: false, msg: '未找到该商铺' };
    if (shop.patrolledToday) return { ok: false, msg: `「${shop.name}」今日已完成巡视` };
    if (this.patrolQuotaLeft <= 0) return { ok: false, msg: '今日 3 次巡视配额已用尽，请等待 04:00 结算重置' };

    this.patrolQuotaLeft -= 1;
    shop.patrolledToday = true;
    shop.maintenanceWear = 0;

    if (isManual) {
      shop.affinity = Math.min(100, shop.affinity + 8);
      this.satDimensions.commerce = Math.min(100, this.satDimensions.commerce + 2);
      this.recalcDerived();
      this.saveToStorage();
      const msg = `🖐️ 亲自巡视「${shop.name}」！效果 100%，客流+15%，店长${shop.boss}好感+8 (♥${shop.affinity})`;
      this.addLog(msg);
      return { ok: true, msg };
    } else {
      shop.affinity = Math.min(100, shop.affinity + 3);
      this.recalcDerived();
      this.saveToStorage();
      const msg = `👔 派店长代办巡视「${shop.name}」（效果 70%），店长好感+3`;
      this.addLog(msg);
      return { ok: true, msg };
    }
  }

  triggerFootstepMorale(shopId) {
    const shop = this.shops.find(s => s.id === shopId);
    if (!shop || shop.moraleBoostedToday) return false;
    shop.moraleBoostedToday = true;
    this.recalcDerived();
    this.addLog(`✨ 街区长走过「${shop.name}」门前，店员士气大振，今日客流 +10%！`);
    return true;
  }

  proposeToShop(shopId) {
    const shop = this.shops.find(s => s.id === shopId);
    if (!shop) return { ok: false, msg: '商铺不存在' };
    if (shop.proposalDone) return { ok: false, msg: '该店专属经营提案已落地' };
    if (shop.affinity < 60) return { ok: false, msg: `店长${shop.boss}好感度不足 60（当前 ♥${shop.affinity}），请先亲自巡视提升关系` };
    if (this.funds < shop.proposalCost) return { ok: false, msg: `资金不足 ¥${shop.proposalCost.toLocaleString()}` };

    this.funds -= shop.proposalCost;
    shop.proposalDone = true;
    shop.appeal = Number((shop.appeal + 0.25).toFixed(2));
    shop.baseRevenue += 3200;
    this.satDimensions.commerce = Math.min(100, this.satDimensions.commerce + 3);
    this.recalcDerived();
    this.saveToStorage();
    const msg = `💡 提案成功！「${shop.name}」落地【${shop.proposalName}】，吸引力永久 +0.25！`;
    this.addLog(msg);
    return { ok: true, msg };
  }

  upgradeShopFloor(shopId) {
    const shop = this.shops.find(s => s.id === shopId);
    if (!shop) return { ok: false, msg: '商铺不存在' };
    if (shop.floors >= 3) return { ok: false, msg: '已达最高层数 (3F)' };
    const cost = 9500;
    if (this.funds < cost) return { ok: false, msg: `加建资金不足 ¥${cost.toLocaleString()}` };

    this.funds -= cost;
    shop.floors += 1;
    shop.level += 1;
    shop.baseRevenue += 3800;
    shop.appeal = Number((shop.appeal + 0.18).toFixed(2));
    this.recalcDerived();
    this.saveToStorage();
    const msg = `🏗️ 「${shop.name}」成功加建至 ${shop.floors} 层！营业面积与天际线高度同步提升！`;
    this.addLog(msg);
    return { ok: true, msg, shop };
  }

  buildNewShop(lotId, templateKey) {
    const lot = this.lots.find(l => l.id === lotId);
    const tpl = BUILDABLE_TEMPLATES[templateKey];
    if (!lot || lot.built || !tpl) return { ok: false, msg: '地块或模板无效' };
    const cost = 12000;
    if (this.funds < cost) return { ok: false, msg: '建造资金不足 ¥12,000' };

    this.funds -= cost;
    lot.built = true;
    const newShop = {
      id: `shop_custom_${Date.now()}`,
      name: tpl.name,
      type: tpl.type,
      category: tpl.category,
      boss: tpl.boss,
      affinity: 65,
      level: 1,
      floors: 2,
      baseRevenue: tpl.baseRevenue,
      appeal: tpl.appeal,
      hours: tpl.hours,
      openStart: tpl.openStart,
      openEnd: tpl.openEnd,
      x: lot.x,
      z: lot.z,
      rotY: lot.rotY,
      mainColor: tpl.mainColor,
      awningColor: tpl.awningColor,
      roofType: tpl.roofType,
      signText: tpl.signText,
      norenText: tpl.norenText,
      proposalName: tpl.proposalName,
      proposalCost: tpl.proposalCost,
      proposalDone: false,
      patrolledToday: true,
      moraleBoostedToday: true,
      maintenanceWear: 0,
      todayVisitors: 32,
      todayRevenue: tpl.baseRevenue
    };
    this.shops.push(newShop);
    this.satDimensions.commerce = Math.min(100, this.satDimensions.commerce + 4);
    this.recalcDerived();
    this.saveToStorage();
    const msg = `🎉 新店开业！在「${lot.name}」建成了【${newShop.name}】！`;
    this.addLog(msg);
    return { ok: true, msg, shop: newShop, lot };
  }

  resolveIssue(issueId, isManual = true) {
    const issue = this.issues.find(i => i.id === issueId);
    if (!issue || issue.resolved) return { ok: false, msg: '该隐患已处理' };
    if (!issue.discovered && isManual) {
      issue.discovered = true;
    }
    issue.resolved = true;
    const reward = isManual ? (this.outfit === 'artisan' ? 2400 : 1200) : 600;
    this.funds += reward;
    this.satDimensions.env = Math.min(100, this.satDimensions.env + (isManual ? 4 : 2));
    this.recalcDerived();
    this.saveToStorage();
    const msg = isManual
      ? `🛠️ 亲手排除隐患【${issue.title}】！环境分+4，获街区自治补贴 ¥${reward.toLocaleString()}`
      : `📋 派店长处理了【${issue.title}】（效果70%），环境分+2`;
    this.addLog(msg);
    return { ok: true, msg };
  }

  extendRoad() {
    const cost = 15000;
    if (this.funds < cost) return { ok: false, msg: '修路扩张需资金 ¥15,000' };
    this.funds -= cost;
    this.roadExtensions += 1;
    this.satDimensions.commute = Math.min(100, this.satDimensions.commute + 5);
    this.recalcDerived();
    this.saveToStorage();
    const msg = `🛣️ 成功向邻街延伸樱花步道（第 ${this.roadExtensions} 期）！道路连通系数提升，日结算影响力扩散加速！`;
    this.addLog(msg);
    return { ok: true, msg };
  }

  runCompetitionTactic(mode) {
    if (mode === 'festival') {
      const cost = 8000;
      if (this.funds < cost) return { ok: false, msg: '举办夜樱祭典需 ¥8,000' };
      this.funds -= cost;
      this.control = Math.min(0.98, Number((this.control + 0.025).toFixed(3)));
      this.rivalControl = Number((1 - this.control).toFixed(3));
      this.satDimensions.env = Math.min(100, this.satDimensions.env + 4);
      this.recalcDerived();
      const msg = '🏮 【良性竞争·樱町夜樱祭】全街灯笼齐亮，文化吸引力辐射邻街，控制度 +2.5%！';
      this.addLog(msg);
      return { ok: true, msg };
    } else {
      const cost = 5000;
      if (this.funds < cost) return { ok: false, msg: '深夜霓虹拉客需 ¥5,000' };
      this.funds -= cost;
      this.control = Math.min(0.98, Number((this.control + 0.03).toFixed(3)));
      this.rivalControl = Number((1 - this.control).toFixed(3));
      this.satDimensions.living = Math.max(40, this.satDimensions.living - 3);
      this.recalcDerived();
      const msg = '⚡ 【灰色手段·深夜拉客与价格战】单日控制度强推 +3.0%，但居民安静度微降 (-3)';
      this.addLog(msg);
      return { ok: true, msg };
    }
  }

  addLog(text) {
    const timeStr = this.getFormattedTime();
    this.logs.unshift(`[${timeStr}] ${text}`);
    if (this.logs.length > 25) this.logs.pop();
  }

  getFormattedTime() {
    const h = String(Math.floor(this.minute / 60)).padStart(2, '0');
    const m = String(this.minute % 60).padStart(2, '0');
    return `${h}:${m}`;
  }

  snapshot() {
    return {
      day: this.day,
      time: this.getFormattedTime(),
      minute: this.minute,
      funds: this.funds,
      level: this.level,
      stars: this.stars,
      households: this.households,
      population: this.population,
      satisfaction: this.satisfaction,
      satDimensions: { ...this.satDimensions },
      dailyVisitors: this.dailyVisitors,
      weather: this.weather,
      personality: this.personality,
      outfit: this.outfit,
      patrolQuotaLeft: this.patrolQuotaLeft,
      control: this.control,
      rivalControl: this.rivalControl,
      shopsCount: this.shops.length,
      unresolvedIssues: this.issues.filter(i => !i.resolved).length
    };
  }

  saveToStorage() {
    try {
      const payload = {
        day: this.day,
        minute: this.minute,
        funds: this.funds,
        households: this.households,
        weather: this.weather,
        personality: this.personality,
        outfit: this.outfit,
        control: this.control,
        roadExtensions: this.roadExtensions,
        satDimensions: this.satDimensions
      };
      localStorage.setItem('sakurablock_save_v1', JSON.stringify(payload));
    } catch (e) {
      // ignore storage quota errors
    }
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem('sakurablock_save_v1');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.funds === 'number') this.funds = data.funds;
      if (typeof data.day === 'number') this.day = data.day;
      if (typeof data.control === 'number') {
        this.control = data.control;
        this.rivalControl = Number((1 - this.control).toFixed(3));
      }
    } catch (e) {
      // ignore parse errors
    }
  }
}
