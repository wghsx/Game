# 🌸 樱町计划 (SakuraBlock) - 3D日本现代都市模拟经营RPG

[![GitHub Repo](https://img.shields.io/badge/GitHub-wghsx%2FGame-blue?logo=github)](https://github.com/wghsx/Game)
[![Three.js](https://img.shields.io/badge/Three.js-0.170.0-black?logo=three.js)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite)](https://vitejs.dev/)

本项目基于 **Three.js + 原生 ES Module / Vite** 构建，完整落地了《Three.js技术基线》、《模拟内核规范》、《街区与场景建模规范》、《街区争霸规范》、《主角设计》与《数值参数总表》等全套设计规范。

街区模型由 **Blender 5.2 脚本化生成**，49 件 GLB 资产覆盖 12 套商铺门脸、团地与町屋住宅、鸟居、高架电车站、通勤电车、轻卡出租车巴士，以及 14 件街道家具（电线杆、信号灯、路镜、邮筒、防撞柱、护栏、止まれ 等）。改尺寸、换配色只要动 `tools/blender_kit.py` 重跑一次，不用在引擎里手摆。详见《建模管线与资产清单》。

---

## 🌟 核心特色与架构

1. **108m × 108m 精细十字商业街**：
   - 14m × 14m 涩谷风全向对角斑马线十字路口与沥青路面。
   - 16 家商铺各配一套 Blender 门脸（便利店、拉面店、居酒屋、昭和喫茶、书店、寿司、药妆、电玩城、町家、钱汤、割烹、屋台），招牌店名运行时贴合，换店不用改模型。
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

## 🖥️ 界面

场景优先，所有面板默认收起，只在屏幕两侧留一条竖标签。

| 操作 | 说明 |
| --- | --- |
| 点左侧「经营手账」或按 `B` | 展开商铺、主角、性格、争霸四个页签 |
| 点右侧「环境」或按 `V` | 展开天气、季节、倍速 |
| `Esc` | 收起全部面板并关闭弹窗 |
| 屏幕底部 | 切换 全景 / 第三人称 / 自由视角，导出实机截图。开局是第三人称 |
| 第三人称下 | `WASD` 走动（相对镜头方向），右键拖动转镜头，滚轮拉远近 |

界面配色是一套纸质手账的调子，墨色文字、发丝分隔线、朱红作唯一强调色。按钮用平面加 1px 描边，不带渐变和投影，按下时下沉 1px。

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
2. 浏览器将自动打开 `http://localhost:5173`（3000 端口被 VS Code MCP 占用，所以挪到 5173）。

---

## 📂 工程目录结构

```text
Game/
├── .vscode/                 # VSCode 统一开发与调试配置 (settings, extensions, launch)
├── assets/                  # Blender 源文件 (SakuraBlock_Kit.blend)
├── docs/                    # 完整设计与技术规范文档中心
│   ├── README.md            # 文档全景导航与分类索引
│   ├── adr/                 # 架构决策记录 (ADR 0001 ~ 0012)
│   ├── preview/             # 模型与实机渲染预览图
│   ├── GLOSSARY.md          # 樱町计划专属术语与词汇表
│   ├── PROJECT_SPEC.md      # 游戏整体技术指标与设计概要
│   ├── 3D资产制作规范.md     # 资产尺度、拓扑、命名规范
│   ├── Three.js技术基线.md   # 渲染器参数、ToneMapping、相机基准、资产管线
│   ├── 建模管线与资产清单.md # 36 件 GLB 的来历、清单、改法与踩坑记录
│   ├── 模拟内核规范.md       # 户与店模拟真源、日结算机制
│   ├── 街区争霸规范.md       # 四大性格、控制度辐射与商业兼并
│   ├── 主角设计.md           # L1~L3价值层级、巡视配额、换装系统
│   ├── 数值参数总表.md       # 经济、客流、升级数值公式
│   ├── 商铺与街区变体设计.md # 16家特色店铺与外观变体
│   ├── 街区与场景建模规范.md # 十字路口与街道横断面尺寸
│   ├── 资产清单与分解.md     # Kit Part 模块拆解表（已作废，留档）
│   ├── 建模产出与发现.md     # 上一轮自建低模的经验总结
│   ├── 现成日式资产调研.md   # 开源日式模型库评估
│   └── 玩法候选池.md         # 扩展玩法机制池
├── public/
│   └── models/              # 49 个 GLB 资产（商铺、住宅、地标、车辆、街道家具）
├── src/
│   ├── main.js              # Three.js 渲染主控制器、四态环境光影、相机与输入响应
│   ├── assets.js            # GLB 资产库：并行加载、实例化、招牌贴名
│   ├── simulation.js        # 独立纯JS模拟经营内核 (暴露至 window.sim)
│   ├── textures.js          # 程序化 Canvas 贴图工厂 (斑马线、暖帘、招牌、Q版角色五官)
│   └── builder.js           # 程序化降级构建器（GLB 加载失败时的兜底）
├── tools/
│   ├── blender_kit.py       # Blender 建模脚本，一条命令重出全部资产
│   ├── blender_preview.py   # 只出预览图，不重建模型
│   ├── verify_game.cjs      # Playwright 起浏览器跑一遍，收报错并截图
│   ├── shots.cjs            # 抓多个机位的实机图
│   └── vscode_mcp.py        # 通过 MCP 协议调 VS Code 工具（诊断、读写文件）
├── index.html               # 游戏主页面、全套 HUD 经营手账与 ImportMap
├── package.json             # Vite + Three.js 依赖配置
├── vite.config.js           # Vite 构建与服务配置（端口 5173）
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
