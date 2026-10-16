# 3D 资产导入说明 (3D Models Directory)

本目录用于存放从 **Blender**、**Sketchfab**、**Booth** 或 **Kenney** 导出的真实高品质 3D 游戏模型资产。

## 1. 推荐使用的 3D 建模软件
- **Blender (官方开源免费，行业标准)**：
  - 官网下载：https://www.blender.org/
  - 适用：场景建筑（罗森便利店、和风拉面屋、一户建住宅）、街道道具（贩卖机、电线杆、自行车）、二次元 Q 版角色制作。

## 2. 导出格式规范 (Export Format)
- 导出文件格式：**`.glb`**（二进制 glTF，已打包内嵌贴图材质，最方便）。
- 坐标轴设定：**Y 轴朝上（Y-Up）**，**-Z 轴朝前（Forward）**。
- 模型原点（Origin）：建议放置在模型底部几何中心（地面接触点），便于放入场景定位。
- 贴图建议：推荐烘焙好 PBR 贴图（Albedo / Normal / Roughness / Emissive）或使用二次元卡通手绘贴图。

## 3. 预留推荐资产文件名
将导出的 `.glb` 文件直接放入本目录即可自动被游戏引用或替换：
- `player.glb` —— 主角店长角色（包含骨骼/动画）
- `lawson.glb` —— 高精度罗森便利店
- `ramen.glb` —— 和风拉面居酒屋（和瓦、木格栅）
- `vending.glb` —— 自动贩卖机
- `house_tanaka.glb` —— 田中家一户建
- `npc_jk.glb` —— 水手服学生 NPC

## 4. 免费优质 3D 资产推荐网站
如果不想从零建模，可以直接下载现成的免费 CC0 / 商业授权模型包：
- **Sketchfab** (搜索: `japanese street`, `konbini`, `anime chibi`)
- **Kenney.nl** (搜索: `City Kit Commercial`, `Nature Kit`)
- **Booth.pm** (日式二次元风格角色与建筑模型宝库)
- **TurboSquid / CGTrader** (免费 LowPoly / Stylized 筛选)
