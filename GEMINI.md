# Three.js 游戏开发与技能自动调用规范

本工作区为游戏开发项目，核心采用 **Three.js** 技术栈。

## 技能自动调用准则 (Automatic Skill Invocation)

在游戏的整个生命周期中（需求分析、原型设计、玩法开发、视觉美术、UI设计、音效集成、性能调优、QA测试与发布），**必须主动查阅并严格按照对应的 Skill 指南规范进行开发，自动触发并应用相关技能，无需等待用户特别说明**。

### 技能路由与分工清单

1. **全局调度与架构 (Game Architecture & Direction)**
   - 技能：`threejs-game-director`
   - 适用场景：项目初始化搭建、模块化架构设计、跨技能协同规划、开发阶段推进。

2. **核心玩法与系统实现 (Gameplay Systems & Mechanics)**
   - 技能：`threejs-gameplay-systems`、`game-engine`、`develop-web-game`
   - 适用场景：游戏主循环（Game Loop）、玩家输入与控制器、物理系统与碰撞检测、实体状态机、关卡生成、摄像机轨道与视角。

3. **视觉效果与渲染品质提升 (AAA Graphics & Visuals)**
   - 技能：`threejs-aaa-graphics-builder`
   - 适用场景：PBR 材质配置、环境光照与阴影、自定义着色器（Shaders/Postprocessing）、粒子系统与 VFX 特效、画质评分与优化。

4. **游戏手感与反馈 (Game Feel & Juice)**
   - 技能：`game-feel`
   - 适用场景：屏幕震动（Screen Shake）、打击停顿（Hit Stop / Freeze frame）、缓动弹性动画（Squash & Stretch）、击退受击反馈、视听联动打击感。

5. **游戏 UI 与 HUD 设计 (Game UI / UX)**
   - 技能：`threejs-game-ui-designer`、`game-ui-design`、`game-ui-ux`
   - 适用场景：游戏内 HUD（血条、能量槽、十字准星、技能冷却）、主菜单、暂停与结算面板、响应式适配与沉浸式 UI。

6. **3D 资产与角色模型 (3D Assets & Rigging)**
   - 技能：`threejs-3d-generator`、`higgsfield-game-generation`
   - 适用场景：3D 模型生成、材质贴图、骨骼绑定、动画重定向与 GLB/FBX 导出导入。
   - **Blender 协同规范**：针对 Blender 的模型操作、材质设置与调整，**统一使用 MCP 工具 (mcp-for-blender) 连接 live Blender 实例进行代码与资产操作**，严禁使用鼠标模拟。

7. **游戏音频与音效 (Audio & SFX)**
   - 技能：`threejs-audio-generator`
   - 适用场景：打击音效、环境音（Ambient）、背景音乐循环（BGM）、Web Audio API 播放与空间音频。

8. **多人联机与网络同步 (Multiplayer & Networking)**
   - 技能：`game-networking`
   - 适用场景：WebSocket 实时通信、房间匹配、帧同步/状态同步、客户端预测与延迟补偿。

9. **性能调优与故障排查 (Profiling & Performance Optimization)**
   - 技能：`threejs-debug-profiler`
   - 适用场景：Draw Calls 与三角面优化、FPS 锁帧与性能瓶颈诊断、GPU 显存与内存泄漏排查。

10. **自动化测试与发布打包 (QA & Release)**
    - 技能：`threejs-qa-release`、`develop-web-game`
    - 适用场景：Playwright 自动化游玩测试、画布截图检验、生产构建与多端适配打包。

## 执行原则
- 遇到具体需求（如“加个冲刺技能”、“优化打击感”、“做个血条UI”等），自动读取对应技能的 `SKILL.md`，按专业设计规范执行。
- 遵循渐进式开发：从核心最小可玩原型（Core Loop）开始，再叠加美术效果、音效与手感。
