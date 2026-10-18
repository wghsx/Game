# 樱町计划 · 项目长期约定

## 资产

- 模型一律 Blender 脚本生成，入口 `tools/blender_kit.py`，**不要**在 Three.js 里手拼建筑几何。
- 几何单位 1 = 1 米，Blender 正面朝 -Y，导出后即 +Z，摆位只用 `rotation.y`。
- 招牌文字不烘进 GLB。模型留空色板并打 `role=sign` 标记，店名由 `src/assets.js` 运行时贴。
- 同一套门脸服务多家店，映射表在 `src/assets.js` 的 `STYLE_BY_SHOP`。

## 端口

- 开发服务器 **5173**。3000 被 VS Code MCP（`juehangqin.vscode-mcp-server`）占用，别改回去。

## 工具

- `tools/verify_game.cjs`：改完必跑，检查加载、报错、draw call，并出一张全景图。
- `tools/shots.cjs`：抓 RPG / 街景近景 / 夜景三张图。
- `tools/vscode_mcp.py`：本会话拿不到 `mcp__vscode__*` 工具时的替代通道，直接走 MCP JSON-RPC 调 VS Code 的 12 个工具。

## 视觉

- 时段预设要连半球光和环境光一起调，只降平行光会出现"夜里发灰"。
- 自发光材质统一走 `emissiveMaterials` 数组，`userData` 里放 `baseIntensity` / `nightIntensity`。
