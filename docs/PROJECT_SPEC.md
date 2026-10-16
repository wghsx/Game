# 樱町计划 (SakuraBlock) 设计规范汇总

本目录包含项目的核心技术基线与玩法规范：
- **技术栈**：Three.js + Vite，入口 `index.html` -> `src/main.js`，模拟内核 `src/simulation.js`，贴图生成 `src/textures.js`，3D建模 `src/builder.js`。
- **渲染基线**：PerspectiveCamera (FOV 28°)，支持正前 45° RPG视角、等距 45° `(58, 48, 58)`、全景 `(88, 72, 88)`；ACESFilmicToneMapping 曝光 1.18。
- **十字商业街扩建版**：108m × 108m 街区，14m × 14m 涩谷风全向斑马线十字路口，16 家精模日式名店 + 12 栋多层居民楼 + 4 处可开发空地。
- **主角三层价值 (L1~L3)**：WASD/点击寻路移动、每日 3 次巡视配额（亲手 100% vs 店长 70%）、8.5m 战争迷雾隐患发现、走过店门触发 +10% 足迹士气光环、老板好感度与经营提案、4 套 3D 实时换装。
