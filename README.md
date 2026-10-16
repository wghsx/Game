# 🌸 樱町计划 (SakuraBlock) - 3D日本现代都市模拟经营RPG

[![GitHub Repo](https://img.shields.io/badge/GitHub-wghsx%2FGame-blue?logo=github)](https://github.com/wghsx/Game)
[![Three.js](https://img.shields.io/badge/Three.js-0.170.0-black?logo=three.js)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite)](https://vitejs.dev/)

本项目基于 **Three.js + 原生 ES Module / Vite** 构建，完整落地了《Three.js技术基线》、《模拟内核规范》、《街区与场景建模规范》、《街区争霸规范》、《主角设计》与《数值参数总表》等全套设计规范。

---

## 🌟 核心特色与架构

1. **108m × 108m 精细十字商业街**：
   - 14m × 14m 涩谷风全向对角斑马线十字路口与沥青路面。
   - 16 家精细化多层日式商铺（拉面馆、便利店、居酒屋、药妆店、漫画屋等，包含暖帘、自发光霓虹招牌、石砌基座、木梁构架、旋转空调外机）。
   - 12 栋居民楼（团地公营住宅 + 传统町屋）、神社鸟居祈愿区、高架电车站与往复电车。
2. **纯 JavaScript 独立模拟经营内核 (`src/simulation.js`)**：
   - 户（Household）与店（Shop）双层模拟真源，与 Three.js 渲染层完全解耦。
   - 每日 04:00 日结算批处理，24 小时真实日夜循环与昼夜光影变化。
   - 控制台挂载 `window.sim`，方便随时注入资金、调时钟、测结算。
3. **主角 L1~L3 深度跑图与巡视价值 (`src/main.js`)**：
   - **L1 实体跑图**：WASD / 点击寻路，8.5m 战争迷雾隐患排查。
   - **L2 主动巡视**：每日 3 次主动巡视配额（亲手处理 100% 收益 vs 店长委托 70%）。
   - **L3 移动光环**：走过店门触发「脚步士气」+10% 营业加成，支持 4 套 3D 换装加成（正装、法被、柴犬玩偶装、浴衣）。
4. **街区争霸与商业兼并**：
   - 四大街区性格：🏡居民街、📸游客街、🍵手艺街、🏮深夜街。
   - 控制度沿路辐射衰减算法与相邻街区商业兼并机制。

---

## 🚀 启动与预览方式

### 方式 1：免安装直接预览（内置 ImportMap 支持，零依赖启动）
- `index.html` 顶部已内置 ES Module `importmap`。
- 如果在 **VSCode** 中安装了 **Live Server** 插件，右键 `index.html` 选择 **"Open with Live Server"**，无需运行 `npm install` 也能瞬间加载并运行整个 3D 游戏！

### 方式 2：标准 Vite 工程启动（开发推荐）
1. 打开终端（VSCode 快捷键 `Ctrl + ~`）：
   ```bash
   npm install
   npm run dev
   ```
2. 浏览器将自动打开 `http://localhost:3000`。

---

## 📂 工程目录结构

```text
Game/
├── .vscode/                 # VSCode 统一开发与调试配置 (settings, extensions, launch)
├── docs/                    # 完整设计与技术规范文档中心
│   ├── README.md            # 文档全景导航与分类索引
│   ├── adr/                 # 架构决策记录 (ADR 0001 ~ 0012)
│   ├── GLOSSARY.md          # 樱町计划专属术语与词汇表
│   ├── PROJECT_SPEC.md      # 游戏整体技术指标与设计概要
│   ├── 3D资产制作规范.md     # 资产尺度、拓扑、命名规范
│   ├── Three.js技术基线.md   # 渲染器参数、ToneMapping、相机基准
│   ├── 模拟内核规范.md       # 户与店模拟真源、日结算机制
│   ├── 街区争霸规范.md       # 四大性格、控制度辐射与商业兼并
│   ├── 主角设计.md           # L1~L3价值层级、巡视配额、换装系统
│   ├── 数值参数总表.md       # 经济、客流、升级数值公式
│   ├── 商铺与街区变体设计.md # 16家特色店铺与外观变体
│   ├── 街区与场景建模规范.md # 十字路口与街道横断面尺寸
│   ├── 资产清单与分解.md     # Kit Part 模块拆解表
│   ├── 建模产出与发现.md     # Blender建模经验总结
│   ├── 现成日式资产调研.md   # 开源日式模型库评估
│   └── 玩法候选池.md         # 扩展玩法机制池
├── public/                  # 静态外部资源目录 (models/ 等)
├── src/
│   ├── main.js              # Three.js 渲染主控制器、四态环境光影、相机与输入响应
│   ├── simulation.js        # 独立纯JS模拟经营内核 (暴露至 window.sim)
│   ├── textures.js          # 程序化 Canvas 贴图工厂 (斑马线、暖帘、招牌、Q版角色五官)
│   └── builder.js           # 3D 场景精细建模构建器 (16家商铺、居民楼、电车站、神社)
├── index.html               # 游戏主页面、全套 HUD 经营手账与 ImportMap
├── package.json             # Vite + Three.js 依赖配置
├── vite.config.js           # Vite 构建与服务配置
└── .gitignore               # Git 忽略配置
```

---

## 🛠️ 控制台开发者调试接口 (`window.sim`)

按 `F12` 打开浏览器控制台（Console），可直接使用内核指令测试游戏机制：

```javascript
// 1. 查看当前街区全部经营状态快照
sim.snapshot();

// 2. 拨动游戏时钟 (例如调到 19:00 夜市高峰)
sim.minute = 1140;

// 3. 修改资金
sim.funds = 9999999;

// 4. 修改控制度测试兼并逻辑
sim.control = 0.95;

// 5. 手动触发一次 04:00 日结算
sim.settle();

// 6. 重置主角每日巡视配额
sim.patrolQuota = 3;
```

---

## 📦 版本管理与 GitHub 协作

本项目代码仓库已关联：[https://github.com/wghsx/Game](https://github.com/wghsx/Game)

### 常用 Git 命令速查
- **查看变动状态**：`git status`
- **保存并提交**：
  ```bash
  git add .
  git commit -m "feat: 你的更新说明"
  ```
- **推送到 GitHub**：
  ```bash
  git push origin main
  ```
- **拉取远程更新**：
  ```bash
  git pull origin main
  ```
- **创建版本发布标签 (Tag)**：
  ```bash
  git tag -a v1.0.0 -m "Release v1.0.0: 十字商业街完整初版"
  git push origin v1.0.0
  ```
