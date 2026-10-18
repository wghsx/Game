# 🌸 樱町计划 (SakuraBlock) 规范文档中心与开发指南

本目录包含《樱町计划》完整的架构决策、游戏机制设计、数值模型、3D资产标准与技术基线规范。全部规范已在代码中完整落地实作。

---

## 📑 文档导航索引

### 1. 🏛️ 架构决策记录 (Architecture Decision Records)
- **[`adr/`](./adr/)** - 核心架构与技术选型决策日志：
  - [`0001-engine-and-target-platform.md`](./adr/0001-engine-and-target-platform.md) - 引擎选型与目标平台演进
  - [`0002-render-style-3d-pixel-isometric.md`](./adr/0002-render-style-3d-pixel-isometric.md) - 3D 像素等距等角视觉风格
  - [`0003-asset-scale-baseline.md`](./adr/0003-asset-scale-baseline.md) - 1 Cell = 1m 空间尺度基准
  - [`0004-building-kit-strategy.md`](./adr/0004-building-kit-strategy.md) - 模块化 Building Kit 组装策略
  - [`0005-pixel-resolution-and-camera.md`](./adr/0005-pixel-resolution-and-camera.md) - 渲染分辨率与相机角度基准
  - [`0006-vertex-color-material-strategy.md`](./adr/0006-vertex-color-material-strategy.md) - 顶点色与无光贴图策略
  - [`0007-realtime-lighting-no-bake.md`](./adr/0007-realtime-lighting-no-bake.md) - 实时光照阴影体系（非烘焙）
  - [`0008-controlled-randomness-street-dressing.md`](./adr/0008-controlled-randomness-street-dressing.md) - 街景受控随机散落与密度倾向
  - [`0009-simulation-core-statistical-truth.md`](./adr/0009-simulation-core-statistical-truth.md) - 模拟真源：户与店双层统计架构
  - [`0010-block-rivalry-commercial-annexation.md`](./adr/0010-block-rivalry-commercial-annexation.md) - 街区性格、控制度辐射与商业兼并
  - [`0011-switch-to-threejs-web.md`](./adr/0011-switch-to-threejs-web.md) - 决议切换至 WebGL Three.js 技术栈
  - [`0012-art-baseline-glb-toon.md`](./adr/0012-art-baseline-glb-toon.md) - 卡通日式低模风格与 GLB 资产管线

---

### 2. 🎮 核心系统与模拟经营 (Gameplay & Simulation)
- **[`模拟内核规范.md`](./模拟内核规范.md)**
  - 核心定义：独立纯 JS 内核（`src/simulation.js`），与渲染完全解耦。
  - 数据模型：户（Household，居住真源）与店（Shop，经营真源）。
  - 时间系统：日夜 24 小时推进，04:00 每日结算批处理。
  - 控制台调试：全局挂载 `window.sim`，方便随时注入资金、调时钟、测结算。

- **[`街区争霸规范.md`](./街区争霸规范.md)**
  - 四大街区性格：🏡居民街（生活品质虹吸）、📸游客街（人流磁铁）、🍵手艺街（稀缺老铺溢价）、🏮深夜街（时差错位）。
  - 扩张与控制度：影响力按格衰减与沿路传播算法。
  - 兼并机制：当相邻街区控制度跌破阈值连续 3 日后触发商业兼并。

- **[`主角设计.md`](./主角设计.md)**
  - 三层核心价值：
    - **L1 实体跑图**：WASD + 点击寻路移动，8.5m 迷雾视野与隐患排查。
    - **L2 亲自巡视**：每日 3 次主动巡视额度（亲手处理 100% 收益 vs 店长 70%）。
    - **L3 移动光环**：走过店门触发「脚步士气」+10% 营业加成，4套专属 3D 换装加成。

- **[`数值参数总表.md`](./数值参数总表.md)**
  - 涵盖初始资金、日收入支出比、招商费用、地块租金、客流量公式、满意度阈值及经验升级成长曲线。

- **[`玩法候选池.md`](./玩法候选池.md)**
  - 记录原型期验证的核心玩法机制与后续版本候选系统（天气连锁事件、节日祭典、深夜食堂特别事件等）。

---

### 3. 🎨 3D 美术、场景与材质规范 (Visual & 3D Assets)
- **[`Three.js技术基线.md`](./Three.js技术基线.md)**
  - 渲染器：`WebGLRenderer` + `ACESFilmicToneMapping` (曝光 1.18) + `PCFSoftShadowMap`。
  - 相机参数：`PerspectiveCamera` (FOV 28°)，三档机位切换（正前 45° RPG、等距 45°、全景鸟瞰）。
  - 环境光与昼夜变化：日间暖白、黄昏金橙、夜间深蓝冷调 + 自发光暖帘霓虹。

- **[`3D资产制作规范.md`](./3D资产制作规范.md)**
  - 模型单位（1 Unit = 1m），网格顶点拓扑控制预算，命名规范（`CHR_`、`FCD_`、`GND_`、`KIT_`）。
  - 贴图与材质分配规范。

- **[`街区与场景建模规范.md`](./街区与场景建模规范.md)**
  - 108m × 108m 十字商业街空间结构，14m × 14m 涩谷风全向斑马线十字路口。
  - 建筑横断面（后巷 1m + 建筑进深 7m + 人行道 3m + 车道 6m）。

- **[`商铺与街区变体设计.md`](./商铺与街区变体设计.md)**
  - 16 家精细化日式名店设计（拉面馆、便利店、居酒屋、药妆店、漫画屋、神社祈愿亭等）与变体外观套件。

- **[`资产清单与分解.md`](./资产清单与分解.md)**
  - 完整模型资产与模块组件（Kit Part）拆解清单。

- **[`建模管线与资产清单.md`](./建模管线与资产清单.md)**
  - 36 件 GLB 的来历、逐件三角面、改法与重出流程、设计踩坑记录。**动模型先看这份。**

- **[`建模产出与发现.md`](./建模产出与发现.md)**
  - 上一轮程序化低模（已停用）的经验总结，留档参考。

- **[`现成日式资产调研.md`](./现成日式资产调研.md)**
  - 外部可复用日式低模资产、开源模型库与兼容性评估。

---

### 4. 📚 术语与总纲 (Glossary & Project Spec)
- **[`GLOSSARY.md`](./GLOSSARY.md)** - 樱町计划专属词汇表（严格区分「格」、「街区」、「门脸」、「模拟真源」、「表现层」等术语）。
- **[`PROJECT_SPEC.md`](./PROJECT_SPEC.md)** - 游戏整体架构与技术指标快速摘要。
