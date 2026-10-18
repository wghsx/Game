"""樱町计划 - Blender 模块化日式街区 Kit 生成器。

在 Blender 5.2 里跑，一条命令产出整套 GLB：
    bpy 内执行 exec(open("tools/blender_kit.py").read())

坐标约定：
    正面朝 -Y，Z 轴向上，1 单位 = 1 米，原点在建筑底面中心。
    glTF 导出后 -Y 变 +Z，正好对上 Three.js 里"门脸在 +Z"的既有约定。
"""

import bpy
import bmesh
import math
import os

from mathutils import Vector, Matrix

OUT_DIR = r"D:/Desktop/Game/public/models"
BLEND_PATH = r"D:/Desktop/Game/assets/SakuraBlock_Kit.blend"
PREVIEW_DIR = r"D:/Desktop/Game/docs/preview"

MAT = {}
CUR = None
CUR_OBJS = []
PREVIEW = {}
FONT = None


# ---------------------------------------------------------------- 基础设施

def srgb(hexv):
    """把 0xRRGGBB 的 sRGB 值转成 Blender 需要的线性值。"""

    def conv(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (conv(hexv >> 16 & 255), conv(hexv >> 8 & 255), conv(hexv & 255))


def reset_scene():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=True)

    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    for font in list(bpy.data.fonts):
        if font.users == 0:
            bpy.data.fonts.remove(font)
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)

    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0


def load_font():
    global FONT
    for path in ("C:/Windows/Fonts/msgothic.ttc",
                 "C:/Windows/Fonts/YuGothM.ttc",
                 "C:/Windows/Fonts/simhei.ttf"):
        if os.path.exists(path):
            try:
                FONT = bpy.data.fonts.load(path)
                print("font:", path)
                return
            except Exception as exc:
                print("font failed:", path, exc)
    print("font: fallback to builtin")


def make_mat(name, hexv, rough=0.85, metal=0.0, emit_hex=None, emit_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    color = srgb(hexv)
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit_hex is not None:
        glow = srgb(emit_hex)
        for key in ("Emission Color", "Emission"):
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = (*glow, 1.0)
                break
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emit_strength
    mat.diffuse_color = (*color, 1.0)
    MAT[name] = mat
    return mat


def build_materials():
    make_mat("plaster_white", 0xF4F0E7, 0.90)
    make_mat("plaster_cream", 0xEBE0C9, 0.90)
    make_mat("plaster_gray", 0xCFD2D4, 0.90)
    make_mat("plaster_blue", 0xB9C7D4, 0.90)
    make_mat("plaster_rose", 0xE7CFC6, 0.90)
    make_mat("concrete_dark", 0x6E747C, 0.92)
    make_mat("wood_dark", 0x3B2418, 0.80)
    make_mat("wood_mid", 0x6B4A2F, 0.80)
    make_mat("wood_light", 0xA87C4F, 0.78)
    make_mat("tile_black", 0x3B4149, 0.62, 0.10)
    make_mat("tile_blue", 0x415971, 0.62, 0.10)
    make_mat("tile_red", 0x6E332C, 0.66, 0.05)
    make_mat("stone", 0x9AA0A4, 0.92)
    make_mat("concrete", 0xC2C6C9, 0.92)
    make_mat("metal", 0x9099A1, 0.45, 0.75)
    make_mat("metal_dark", 0x4C5661, 0.42, 0.70)
    make_mat("metal_blue", 0x1F5F93, 0.45, 0.55)
    make_mat("gold", 0xD9A93C, 0.35, 0.85)

    make_mat("glass_warm", 0xF6D79A, 0.18, 0.0, 0xFFC061, 1.25)
    make_mat("glass_cool", 0x8FA6B8, 0.18, 0.0, 0x6E8CA4, 0.20)
    make_mat("lamp_red", 0xD93A2B, 0.45, 0.0, 0xFF5A3C, 3.0)
    make_mat("lamp_white", 0xFFF3D6, 0.35, 0.0, 0xFFE2A8, 2.4)

    make_mat("neon_pink", 0xE23A6B, 0.35, 0.0, 0xFF4F87, 3.4)
    make_mat("neon_cyan", 0x2FB6C9, 0.35, 0.0, 0x4FE0F0, 3.0)
    make_mat("neon_amber", 0xE0A02A, 0.35, 0.0, 0xFFBB44, 2.8)
    make_mat("sign_navy", 0x16305A, 0.55, 0.0, 0x2A4E86, 0.9)
    make_mat("sign_red", 0x8E1C1C, 0.55, 0.0, 0xC0302A, 0.9)
    make_mat("sign_green", 0x1E5138, 0.55, 0.0, 0x2E7A50, 0.9)
    make_mat("sign_yellow", 0xE0B520, 0.55, 0.0, 0xFFD34D, 1.0)
    make_mat("sign_black", 0x1A1D22, 0.55, 0.0, 0x2A2F38, 0.7)

    make_mat("cloth_red", 0x9E2B25, 0.95)
    make_mat("cloth_indigo", 0x233456, 0.95)
    make_mat("cloth_green", 0x2F5E45, 0.95)
    make_mat("cloth_white", 0xEFE8D8, 0.95)
    make_mat("canvas_blue", 0x2C6FA8, 0.90)
    make_mat("canvas_green", 0x2F6B4F, 0.90)
    make_mat("leaf_sakura", 0xE8A0B8, 0.90)
    make_mat("leaf_green", 0x4E7A46, 0.92)
    make_mat("bark", 0x4A3324, 0.95)
    make_mat("ground", 0xD9D5CD, 0.95)
    make_mat("interior", 0x2B2622, 0.95)
    make_mat("interior_shelf", 0x6A5B49, 0.90)


def begin(name):
    global CUR, CUR_OBJS
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    CUR = col
    CUR_OBJS = []
    return col


def link(ob):
    CUR.objects.link(ob)
    CUR_OBJS.append(ob)
    return ob


def adopt(ob):
    for col in list(ob.users_collection):
        col.objects.unlink(ob)
    return link(ob)


def _finish(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    me.materials.append(mat)
    return link(ob)


def box(name, size, loc, mat, rot=(0.0, 0.0, 0.0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if any(rot):
        mtx = (Matrix.Rotation(rot[2], 3, 'Z')
               @ Matrix.Rotation(rot[1], 3, 'Y')
               @ Matrix.Rotation(rot[0], 3, 'X'))
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=mtx)
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector(loc))
    return _finish(name, bm, mat)


def cyl(name, r1, r2, h, loc, mat, rot=(0.0, 0.0, 0.0), segs=12):
    bm = bmesh.new()
    try:
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                              radius1=r1, radius2=r2, depth=h)
    except TypeError:
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                              diameter1=r1 * 2, diameter2=r2 * 2, depth=h)
    if any(rot):
        mtx = (Matrix.Rotation(rot[2], 3, 'Z')
               @ Matrix.Rotation(rot[1], 3, 'Y')
               @ Matrix.Rotation(rot[0], 3, 'X'))
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=mtx)
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector(loc))
    return _finish(name, bm, mat)


def blob(name, radius, loc, mat, subdivisions=1, scale=(1, 1, 1)):
    bm = bmesh.new()
    try:
        bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
    except TypeError:
        bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, diameter=radius * 2)
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector(loc))
    return _finish(name, bm, mat)


def torus(name, major, minor, loc, mat, rot=(math.pi / 2, 0, 0), seg_major=12, seg_minor=5):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor,
        major_segments=seg_major, minor_segments=seg_minor,
        location=loc, rotation=rot,
    )
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(mat)
    return adopt(ob)


def text(name, body, size, loc, mat, rot=(math.pi / 2, 0, 0), extrude=0.006):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = body
    curve.size = size
    curve.extrude = extrude
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.resolution_u = 2
    if FONT is not None:
        curve.font = FONT
    ob = bpy.data.objects.new(name, curve)
    ob.location = loc
    ob.rotation_euler = rot
    curve.materials.append(mat)
    link(ob)

    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target='MESH')
    return ob


def gable(name, width, depth, rise, mat, z, over=0.55):
    """人字形屋顶的实心体，屋脊沿 X 轴。"""
    bm = bmesh.new()
    w = width / 2 + over
    d = depth / 2 + over
    v = [bm.verts.new((-w, -d, 0)), bm.verts.new((w, -d, 0)),
         bm.verts.new((w, d, 0)), bm.verts.new((-w, d, 0)),
         bm.verts.new((-w, 0, rise)), bm.verts.new((w, 0, rise))]
    bm.faces.new([v[0], v[1], v[5], v[4]])
    bm.faces.new([v[2], v[3], v[4], v[5]])
    bm.faces.new([v[0], v[4], v[3]])
    bm.faces.new([v[1], v[2], v[5]])
    bm.faces.new([v[0], v[1], v[2], v[3]])
    bm.normal_update()
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector((0, 0, z)))
    return _finish(name, bm, mat)


def tri_count(objs):
    total = 0
    for ob in objs:
        if ob.type != 'MESH':
            continue
        me = ob.data
        me.calc_loop_triangles()
        total += len(me.loop_triangles)
    return total


def export_current(name):
    if not CUR_OBJS:
        print("skip empty", name)
        return
    bpy.ops.object.select_all(action='DESELECT')
    for ob in CUR_OBJS:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = CUR_OBJS[0]
    path = os.path.join(OUT_DIR, name + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )
    print("export %-22s tris=%5d  %6.1f KB" % (
        name, tri_count(CUR_OBJS), os.path.getsize(path) / 1024.0))


def hide(objs, flag=True):
    for ob in objs:
        ob.hide_render = flag
        ob.hide_viewport = flag


# ---------------------------------------------------------------- 街道配件

def prop_lantern(x, y, z, scale=1.0, mat_name="lamp_red"):
    cyl("lantern_body", 0.20 * scale, 0.20 * scale, 0.46 * scale,
        (x, y, z), MAT[mat_name], segs=10)
    cyl("lantern_cap", 0.12 * scale, 0.12 * scale, 0.05 * scale,
        (x, y, z + 0.25 * scale), MAT["wood_dark"], segs=10)
    cyl("lantern_cap", 0.12 * scale, 0.12 * scale, 0.05 * scale,
        (x, y, z - 0.25 * scale), MAT["wood_dark"], segs=10)


def prop_vending(x, y, z, body="metal_blue"):
    box("vending", (0.92, 0.70, 1.86), (x, y, z + 0.93), MAT[body])
    box("vending_face", (0.78, 0.05, 1.26), (x, y - 0.36, z + 1.10), MAT["lamp_white"])
    for i in range(3):
        box("vending_shelf", (0.74, 0.04, 0.04), (x, y - 0.40, z + 0.72 + i * 0.36),
            MAT["metal_dark"])
    box("vending_slot", (0.52, 0.05, 0.22), (x, y - 0.38, z + 0.26), MAT["metal_dark"])


def prop_bike(x, y, z, rot_y=0.0):
    d = 0.62
    for sign in (-1, 1):
        wx = x + math.cos(rot_y) * sign * d * 0.5
        wy = y + math.sin(rot_y) * sign * d * 0.5
        torus("wheel", 0.29, 0.035, (wx, wy, z + 0.29), MAT["metal_dark"],
              rot=(math.pi / 2, 0, rot_y))
    box("bike_frame", (0.86, 0.05, 0.05), (x, y, z + 0.56), MAT["metal_blue"],
        rot=(0, 0, rot_y))
    cyl("bike_seat", 0.06, 0.06, 0.10, (x - 0.10, y, z + 0.66), MAT["wood_dark"],
        rot=(0, 0, rot_y), segs=6)
    box("bike_basket", (0.26, 0.28, 0.22), (x + 0.44, y, z + 0.72), MAT["wood_mid"],
        rot=(0, 0, rot_y))


def prop_ac(x, y, z, face=-1):
    box("ac_body", (0.42, 0.56, 0.66), (x, y, z), MAT["plaster_white"])
    cyl("ac_fan", 0.21, 0.21, 0.06, (x, y + face * 0.30, z), MAT["metal_dark"],
        rot=(math.pi / 2, 0, 0), segs=12)
    box("ac_bracket", (0.50, 0.10, 0.06), (x, y, z - 0.38), MAT["metal"])


def prop_planter(x, y, z, w=0.46):
    box("planter", (w, w, 0.42), (x, y, z + 0.21), MAT["stone"])
    blob("shrub", w * 0.62, (x, y, z + 0.60), MAT["leaf_green"], 1, (1.1, 1.1, 0.8))


def prop_aboard(x, y, z):
    box("aboard_a", (0.52, 0.05, 0.86), (x, y, z + 0.46), MAT["wood_mid"],
        rot=(math.radians(9), 0, 0))
    box("aboard_b", (0.52, 0.05, 0.86), (x, y - 0.16, z + 0.46), MAT["wood_mid"],
        rot=(math.radians(-9), 0, 0))
    box("aboard_paper", (0.42, 0.02, 0.66), (x, y - 0.08, z + 0.50), MAT["cloth_white"],
        rot=(math.radians(-9), 0, 0))


def prop_stone_lantern(x, y, z):
    cyl("sl_base", 0.22, 0.24, 0.36, (x, y, z + 0.18), MAT["stone"], segs=8)
    cyl("sl_post", 0.10, 0.10, 0.62, (x, y, z + 0.66), MAT["stone"], segs=8)
    box("sl_box", (0.34, 0.34, 0.30), (x, y, z + 1.10), MAT["stone"])
    box("sl_light", (0.20, 0.20, 0.18), (x, y, z + 1.10), MAT["lamp_white"])
    cyl("sl_roof", 0.32, 0.06, 0.22, (x, y, z + 1.34), MAT["stone"], segs=6)


def prop_pole(x, y, z):
    cyl("pole", 0.13, 0.15, 9.2, (x, y, z + 4.6), MAT["concrete"], segs=8)
    for i, zz in enumerate((7.4, 8.3)):
        box("crossarm", (1.5, 0.09, 0.09), (x, y, z + zz), MAT["metal_dark"])
        for off in (-0.55, 0.55):
            cyl("insulator", 0.06, 0.06, 0.14, (x + off, y, z + zz + 0.12),
                MAT["plaster_gray"], segs=6)
    cyl("transformer", 0.26, 0.26, 0.72, (x + 0.34, y, z + 6.4), MAT["metal"], segs=10)


def prop_bench(x, y, z):
    box("bench_seat", (1.5, 0.44, 0.08), (x, y, z + 0.44), MAT["wood_light"])
    box("bench_back", (1.5, 0.07, 0.34), (x, y + 0.20, z + 0.66), MAT["wood_light"],
        rot=(math.radians(-8), 0, 0))
    for off in (-0.62, 0.62):
        box("bench_leg", (0.08, 0.40, 0.44), (x + off, y, z + 0.22), MAT["metal_dark"])


# ---------------------------------------------------------------- 商铺

def noren(width, y, z, cloth, body, char_size=0.19):
    count = 3
    seg = width / count
    for i in range(count):
        cx = -width / 2 + seg * (i + 0.5)
        box("noren", (seg - 0.045, 0.03, 0.66), (cx, y, z), MAT[cloth])
    if body:
        text("noren_text", body, char_size, (0, y - 0.03, z), MAT["cloth_white"])


def shopfront(cfg, W, D, trim):
    front = -D / 2
    glass = MAT[cfg.get("glass", "glass_warm")]

    box("shop_interior", (W - 1.10, 0.16, 2.28), (-W * 0.06, front + 0.16, 1.46),
        MAT["interior"])
    box("shop_shelf", (W - 1.50, 0.20, 0.10), (-W * 0.10, front + 0.10, 1.05),
        MAT["interior_shelf"])
    box("shop_shelf", (W - 1.50, 0.20, 0.10), (-W * 0.10, front + 0.10, 1.72),
        MAT["interior_shelf"])
    box("shop_glass", (W - 1.30, 0.09, 2.24), (-W * 0.06, front - 0.02, 1.46), glass)
    for gx in (-W * 0.38, -W * 0.20, W * 0.02):
        box("mullion", (0.07, 0.13, 2.30), (gx, front - 0.06, 1.46), trim)
    box("door", (1.16, 0.15, 2.12), (W * 0.30, front - 0.07, 1.40), trim)
    box("door_glass", (0.84, 0.05, 1.52), (W * 0.30, front - 0.15, 1.55), glass)
    box("door_handle", (0.05, 0.05, 0.34), (W * 0.30 - 0.30, front - 0.19, 1.42),
        MAT["gold"])
    box("threshold", (1.55, 0.58, 0.11), (W * 0.30, front - 0.25, 0.35), MAT["stone"])


def lattice(width, y, z0, z1, mat, bars=9):
    span = z1 - z0
    box("lattice_rail", (width, 0.06, 0.07), (0, y, z1), mat)
    box("lattice_rail", (width, 0.06, 0.07), (0, y, z0), mat)
    step = width / (bars + 1)
    for i in range(bars):
        bx = -width / 2 + step * (i + 1)
        box("lattice_bar", (0.045, 0.05, span), (bx, y, (z0 + z1) / 2), mat)


def upper_window(y, z, W, trim, glass_name="glass_cool", wide=0.62):
    w = W * wide
    box("win_frame", (w + 0.14, 0.10, 1.34), (0, y, z), trim)
    box("win_back", (w, 0.08, 1.20), (0, y + 0.10, z), MAT["interior"])
    box("win_glass", (w, 0.05, 1.20), (0, y - 0.04, z), MAT[glass_name])
    for i in range(-1, 2):
        box("win_bar", (0.045, 0.05, 1.20), (i * w / 3.2, y - 0.07, z), trim)
    box("win_sill", (w + 0.22, 0.20, 0.08), (0, y - 0.05, z - 0.70), MAT["stone"])


def balcony(y, z, W, trim):
    box("balcony_slab", (W * 0.82, 0.78, 0.10), (0, y - 0.34, z - 0.62), MAT["concrete"])
    box("balcony_rail", (W * 0.82, 0.05, 0.06), (0, y - 0.70, z - 0.14), trim)
    for i in range(9):
        bx = -W * 0.41 + (W * 0.82 / 8) * i
        box("balcony_post", (0.035, 0.035, 0.52), (bx, y - 0.70, z - 0.40), trim)


def roof_flat(W, D, z, wall_trim):
    box("parapet", (W + 0.30, D + 0.30, 0.46), (0, 0, z + 0.23), MAT["concrete"])
    box("roof_deck", (W + 0.10, D + 0.10, 0.10), (0, 0, z + 0.05), MAT["stone"])
    cyl("water_tank", 0.62, 0.62, 1.10, (-W * 0.22, D * 0.14, z + 1.05),
        MAT["metal"], segs=12)
    box("tank_leg", (0.08, 0.08, 0.50), (-W * 0.22 - 0.4, D * 0.14, z + 0.25),
        MAT["metal_dark"])
    box("tank_leg", (0.08, 0.08, 0.50), (-W * 0.22 + 0.4, D * 0.14, z + 0.25),
        MAT["metal_dark"])
    prop_ac(W * 0.24, D * 0.20, z + 0.62, -1)


def roof_gable(W, D, z, tile_name, rise=1.9):
    gable("roof", W, D, rise, MAT[tile_name], z - 0.02, over=0.62)
    cyl("ridge", 0.10, 0.10, W + 1.24, (0, 0, z + 0.10 + rise),
        MAT["tile_black"], rot=(0, math.pi / 2, 0), segs=8)
    box("eave_front", (W + 1.24, 0.16, 0.26), (0, -D / 2 - 0.55, z - 0.14),
        MAT["wood_dark"])
    box("eave_back", (W + 1.24, 0.16, 0.26), (0, D / 2 + 0.55, z - 0.14),
        MAT["wood_dark"])
    box("frieze", (W + 1.10, 0.12, 0.30), (0, -D / 2 - 0.02, z - 0.20),
        MAT["plaster_white"])
    for i in range(7):
        bx = -W * 0.42 + (W * 0.84 / 6) * i
        box("rafter", (0.08, 0.62, 0.10), (bx, -D / 2 - 0.30, z - 0.02),
            MAT["wood_dark"])
    box("gutter", (W + 1.30, 0.12, 0.12), (0, -D / 2 - 0.62, z - 0.26), MAT["metal"])
    cyl("downpipe", 0.055, 0.055, z - 0.26, (W / 2 + 0.10, -D / 2 - 0.05, (z - 0.26) / 2),
        MAT["metal"], segs=6)


def signboard(W, D, z, key_mat, width_ratio=0.80):
    """灯箱招牌。外框、内凹面板、上下铝型材、顶部灯带四件套。
    面板本身留空，店名由 Three.js 按包围盒贴上去，一套门脸能服务多家店。"""
    w = W * width_ratio
    y0 = -D / 2

    box("sign_case", (w + 0.20, 0.34, 1.02), (0, y0 - 0.17, z), MAT["metal_dark"])
    box("sign_rim_top", (w + 0.30, 0.40, 0.07), (0, y0 - 0.18, z + 0.54), MAT["metal"])
    box("sign_rim_bot", (w + 0.30, 0.40, 0.07), (0, y0 - 0.18, z - 0.54), MAT["metal"])
    for sx in (-1, 1):
        box("sign_rim_side", (0.07, 0.40, 1.02), (sx * (w / 2 + 0.11), y0 - 0.18, z),
            MAT["metal"])

    face = box("sign_face", (w, 0.12, 0.84), (0, y0 - 0.34, z), MAT[key_mat])
    face["role"] = "sign"

    # 招牌顶上的灯带，夜里从下往上洗亮面板
    box("sign_lamp", (w * 0.88, 0.10, 0.06), (0, y0 - 0.40, z + 0.44), MAT["lamp_white"])
    box("sign_lamp_arm", (0.06, 0.34, 0.06), (-w * 0.36, y0 - 0.22, z + 0.46),
        MAT["metal_dark"])
    box("sign_lamp_arm", (0.06, 0.34, 0.06), (w * 0.36, y0 - 0.22, z + 0.46),
        MAT["metal_dark"])
    return z


def blade_sign(W, D, H, z, key_mat):
    """侧挂竖招。上下各一道抱箍接到墙上，两端加铝盖。"""
    x = W / 2 + 0.17
    y = -D / 2 + 0.36
    for zz in (z - 0.64, z + 0.64):
        box("blade_arm", (0.36, 0.07, 0.07), (W / 2 + 0.15, y, zz), MAT["metal_dark"])
    board = box("blade_board", (0.18, 0.66, 2.02), (x, y, z), MAT[key_mat])
    board["role"] = "blade"
    box("blade_cap", (0.24, 0.72, 0.06), (x, y, z + 1.04), MAT["metal_dark"])
    box("blade_cap", (0.24, 0.72, 0.06), (x, y, z - 1.04), MAT["metal_dark"])


def build_shop(cfg, floors):
    key = cfg["key"]
    name = "shop_%s_%df" % (key, floors)
    begin(name)

    W = cfg.get("w", 7.2)
    D = cfg.get("d", 6.4)
    FH = 3.05
    H = floors * FH
    top = 0.30 + H
    front = -D / 2

    wall = MAT[cfg["wall"]]
    trim = MAT[cfg["trim"]]

    box("base", (W + 0.38, D + 0.38, 0.30), (0, 0, 0.15), MAT["stone"])
    box("body", (W, D, H), (0, 0, 0.30 + H / 2), wall)

    for sx in (-1, 1):
        for sy in (-1, 1):
            box("post", (0.20, 0.20, H), (sx * (W / 2 - 0.01), sy * (D / 2 - 0.01),
                                        0.30 + H / 2), trim)
    for f in range(1, floors + 1):
        box("beam", (W + 0.16, D + 0.16, 0.16), (0, 0, 0.30 + f * FH), trim)

    facade = cfg.get("facade", "glass")
    if facade == "glass":
        shopfront(cfg, W, D, trim)
    elif facade == "lattice":
        shopfront(cfg, W, D, trim)
        lattice(W * 0.72, front - 0.10, 0.55, 2.55, trim, bars=11)
    elif facade == "bay":
        box("bay", (W * 0.46, 0.86, 1.80), (-W * 0.16, front - 0.40, 1.55),
            MAT["wood_mid"])
        box("bay_glass", (W * 0.38, 0.06, 1.42), (-W * 0.16, front - 0.82, 1.62),
            MAT["glass_warm"])
        box("bay_roof", (W * 0.50, 1.02, 0.10), (-W * 0.16, front - 0.45, 2.50),
            MAT["tile_blue"], rot=(math.radians(6), 0, 0))
        shopfront(cfg, W, D, trim)
    elif facade == "timber":
        box("panel", (W * 0.78, 0.10, 2.30), (0, front - 0.04, 1.46), MAT["wood_mid"])
        box("panel_glass", (W * 0.34, 0.05, 1.60), (W * 0.14, front - 0.12, 1.60),
            MAT["glass_warm"])
        box("door", (1.20, 0.16, 2.10), (-W * 0.26, front - 0.10, 1.40),
            MAT["wood_dark"])
        box("threshold", (1.60, 0.60, 0.11), (-W * 0.26, front - 0.28, 0.35),
            MAT["stone"])

    awning = cfg.get("awning")
    if awning == "canopy":
        box("awning", (W * 0.96, 1.18, 0.10), (0, front - 0.55, 2.92),
            MAT[cfg.get("awning_mat", "canvas_blue")], rot=(math.radians(-7), 0, 0))
        box("awning_lip", (W * 0.96, 0.07, 0.34), (0, front - 1.13, 2.68),
            MAT["plaster_white"])
        box("awning_rail", (W * 0.98, 0.05, 0.05), (0, front - 0.10, 2.97),
            MAT["metal_dark"])
    elif awning == "stripe":
        seg = W * 0.96 / 8
        for i in range(8):
            cx = -W * 0.48 + seg * (i + 0.5)
            mat = MAT[cfg.get("awning_mat", "cloth_green")] if i % 2 == 0 else MAT["cloth_white"]
            box("awning_stripe", (seg, 1.12, 0.09), (cx, front - 0.52, 2.92), mat,
                rot=(math.radians(-9), 0, 0))
    elif awning == "deep_eave":
        box("eave", (W + 0.90, 1.70, 0.14), (0, front - 0.60, 2.94), MAT["tile_black"],
            rot=(math.radians(-4), 0, 0))
        box("eave_edge", (W + 0.90, 0.10, 0.12), (0, front - 1.42, 2.86),
            MAT["wood_dark"])

    if cfg.get("noren"):
        noren(W * 0.62, front - 0.36, 2.44, cfg["noren_cloth"], cfg["noren"],
              cfg.get("noren_size", 0.19))

    sign_z = 0.30 + FH - 0.28
    signboard(W, D, sign_z, cfg.get("sign_mat", "sign_navy"), cfg.get("sign_w", 0.80))
    if cfg.get("blade"):
        blade_sign(W, D, H, 0.30 + H * 0.58, cfg.get("blade_mat", "lamp_white"))

    if facade in ("lattice", "timber"):
        for i in range(6):
            bx = -W * 0.40 + (W * 0.80 / 5) * i
            box("wall_batten", (0.06, 0.05, H - FH - 0.30),
                (bx, front - 0.03, 0.30 + FH + (H - FH) / 2), MAT["wood_mid"])

    for i in range(1, floors):
        upper_window(front - 0.02, 0.30 + FH * i + 1.55, W, trim,
                     cfg.get("upper_glass", "glass_cool"))
        if cfg.get("balcony", True):
            balcony(front, 0.30 + FH * i + 1.95, W, trim)

    prop_ac(W / 2 + 0.20, -D * 0.10, 0.30 + FH * 0.62, 1)

    if cfg.get("roof") == "gable":
        roof_gable(W, D, top, cfg.get("tile", "tile_black"), cfg.get("rise", 1.9))
    elif cfg.get("roof") == "gable_deep":
        roof_gable(W, D, top, cfg.get("tile", "tile_blue"), cfg.get("rise", 2.3))
        box("gable_end", (0.16, D * 0.86, 0.90), (W / 2 + 0.02, 0, top + 0.55),
            MAT[cfg["wall"]])
    else:
        roof_flat(W, D, top, trim)

    for prop in cfg.get("props", []):
        if prop == "lantern":
            prop_lantern(-W * 0.34, front - 0.72, 2.30)
            prop_lantern(W * 0.34, front - 0.72, 2.30)
        elif prop == "lantern_row":
            for i in range(3):
                prop_lantern(-W * 0.36 + i * W * 0.36, front - 0.78, 2.24, 0.90,
                             "lamp_red")
        elif prop == "vending":
            prop_vending(-W / 2 + 0.72, front - 0.44, 0.30)
        elif prop == "bike":
            prop_bike(W / 2 - 0.85, front - 0.72, 0.30, 0.0)
        elif prop == "aboard":
            prop_aboard(-W / 2 + 1.05, front - 0.92, 0.30)
        elif prop == "planter":
            prop_planter(-W * 0.44, front - 0.52, 0.30)
            prop_planter(-W * 0.44 + 0.56, front - 0.52, 0.30)
        elif prop == "stone_lantern":
            prop_stone_lantern(-W * 0.40, front - 0.80, 0.30)
            prop_stone_lantern(W * 0.40, front - 0.80, 0.30)
        elif prop == "chimney":
            cyl("chimney", 0.34, 0.30, 3.60, (W * 0.30, D * 0.22, top + 1.20),
                MAT["plaster_gray"], segs=10)
            cyl("chimney_cap", 0.42, 0.42, 0.14, (W * 0.30, D * 0.22, top + 3.06),
                MAT["metal_dark"], segs=10)
        elif prop == "nobori":
            prop_nobori(-W * 0.42, front - 0.96, 0.30, "cloth_red", "営業中")
            prop_nobori(W * 0.42, front - 0.96, 0.30, "cloth_indigo", "営業中")
        elif prop == "pot":
            prop_planter(-W * 0.46, front - 0.46, 0.30, 0.40)
            prop_planter(W * 0.46, front - 0.46, 0.30, 0.40)
        elif prop == "neon":
            box("neon_strip", (W * 0.90, 0.06, 0.10), (0, front - 0.10, 2.68),
                MAT["neon_pink"])
            box("neon_strip", (W * 0.90, 0.06, 0.10), (0, front - 0.10, 0.62),
                MAT["neon_cyan"])

    export_current(name)
    return CUR_OBJS


STYLES = [
    dict(key="konbini", wall="plaster_white", trim="metal_blue", roof="flat",
         facade="glass", awning="canopy", awning_mat="canvas_blue",
         sign_mat="sign_navy", props=["vending", "bike"], glass="glass_warm"),
    dict(key="ramen", wall="plaster_cream", trim="wood_dark", roof="gable",
         tile="tile_black", rise=1.8, facade="lattice", awning="deep_eave",
         sign_mat="sign_red", props=["lantern", "aboard", "nobori"], noren="らーめん",
         noren_cloth="cloth_red", glass="glass_warm", blade=True,
         blade_mat="lamp_white"),
    dict(key="izakaya", wall="wood_mid", trim="wood_dark", roof="gable",
         tile="tile_black", rise=1.55, facade="lattice", awning="deep_eave",
         sign_mat="sign_red", props=["lantern_row", "aboard", "nobori"], noren="やきとり",
         noren_cloth="cloth_indigo", glass="glass_warm"),
    dict(key="cafe", wall="plaster_rose", trim="wood_mid", roof="flat",
         facade="bay", awning="stripe", awning_mat="cloth_green",
         sign_mat="sign_green", props=["planter", "bike", "pot"], noren=None,
         glass="glass_warm"),
    dict(key="bookstore", wall="plaster_blue", trim="metal_dark", roof="flat",
         facade="glass", awning="canopy", awning_mat="sign_navy",
         sign_mat="sign_navy", props=["bike"], glass="glass_warm",
         upper_glass="glass_warm", balcony=False),
    dict(key="sushi", wall="plaster_white", trim="wood_light", roof="gable",
         tile="tile_blue", rise=1.7, facade="timber", awning="deep_eave",
         sign_mat="sign_navy", props=["stone_lantern"], noren="鮨",
         noren_cloth="cloth_indigo", glass="glass_warm"),
    dict(key="drugstore", wall="plaster_white", trim="metal_blue", roof="flat",
         facade="glass", awning="canopy", awning_mat="sign_yellow",
         sign_mat="sign_yellow", props=["vending", "nobori"], glass="glass_warm",
         blade=True, blade_mat="sign_yellow"),
    dict(key="arcade", wall="concrete_dark", trim="metal_dark", roof="flat",
         facade="glass", awning="canopy", awning_mat="neon_pink",
         sign_mat="neon_pink", props=["neon"], glass="glass_warm",
         balcony=False, blade=True, blade_mat="neon_cyan"),
    dict(key="machiya", wall="plaster_cream", trim="wood_dark", roof="gable",
         tile="tile_blue", rise=1.9, facade="lattice", awning="deep_eave",
         sign_mat="sign_black", props=["noren"], noren="きもの",
         noren_cloth="cloth_indigo", glass="glass_warm", w=7.0, d=6.6),
    dict(key="sento", wall="plaster_cream", trim="wood_mid", roof="gable_deep",
         tile="tile_red", rise=2.6, facade="timber", awning="deep_eave",
         sign_mat="sign_black", props=["chimney", "stone_lantern"], noren="ゆ",
         noren_cloth="cloth_indigo", noren_size=0.30, glass="glass_warm"),
    dict(key="kappo", wall="wood_dark", trim="wood_dark", roof="gable",
         tile="tile_black", rise=1.5, facade="timber", awning="deep_eave",
         sign_mat="sign_black", props=["lantern"], noren="懐石",
         noren_cloth="cloth_white", glass="glass_warm", blade=True,
         blade_mat="lamp_white"),
    dict(key="yatai", wall="wood_mid", trim="wood_dark", roof="gable",
         tile="tile_black", rise=1.1, facade="timber", awning="deep_eave",
         sign_mat="sign_red", props=["lantern_row"], noren="たこ焼",
         noren_cloth="cloth_red", glass="glass_warm"),
]


# ---------------------------------------------------------------- 住宅与地标

def build_danchi(floors=4):
    name = "res_danchi_%df" % floors
    begin(name)
    W, D, FH = 9.4, 6.8, 2.85
    H = floors * FH
    box("base", (W + 0.30, D + 0.30, 0.24), (0, 0, 0.12), MAT["stone"])
    box("body", (W, D, H), (0, 0, 0.24 + H / 2), MAT["concrete"])

    for f in range(floors):
        z = 0.24 + f * FH
        box("slab", (W + 0.14, D + 0.14, 0.16), (0, 0, z + FH), MAT["plaster_gray"])
        for gx in (-W * 0.28, 0.0, W * 0.28):
            box("win", (1.35, 0.08, 1.20), (gx, -D / 2 - 0.02, z + 1.55),
                MAT["glass_warm"])
            box("win_frame", (1.47, 0.05, 0.10), (gx, -D / 2 - 0.06, z + 0.92),
                MAT["metal_dark"])
        if f > 0:
            box("balcony", (W * 0.90, 0.72, 0.10), (0, -D / 2 - 0.34, z + 0.55),
                MAT["plaster_gray"])
            box("rail", (W * 0.90, 0.05, 0.06), (0, -D / 2 - 0.68, z + 1.10),
                MAT["metal_dark"])
            for i in range(12):
                bx = -W * 0.45 + (W * 0.90 / 11) * i
                box("post", (0.03, 0.03, 0.52), (bx, -D / 2 - 0.68, z + 0.84),
                    MAT["metal_dark"])
            prop_ac(-W * 0.30, -D / 2 - 0.70, z + 1.05, -1)

        for gx in (-W * 0.28, 0.0, W * 0.28):
            box("win_back", (1.35, 0.08, 1.20), (gx, D / 2 + 0.02, z + 1.55),
                MAT["glass_warm"])
            box("win_back_frame", (1.47, 0.05, 0.10), (gx, D / 2 + 0.06, z + 0.92),
                MAT["metal_dark"])
        for gz in (-D * 0.24, D * 0.24):
            box("win_side", (0.08, 1.20, 1.15), (W / 2 + 0.02, gz, z + 1.55),
                MAT["glass_warm"])
            box("win_side", (0.08, 1.20, 1.15), (-W / 2 - 0.02, gz, z + 1.55),
                MAT["glass_warm"])

    box("stair_core", (1.9, D * 0.92, H), (W / 2 + 0.72, 0, 0.24 + H / 2),
        MAT["plaster_gray"])
    box("roof_parapet", (W + 0.34, D + 0.34, 0.60), (0, 0, 0.24 + H + 0.30),
        MAT["plaster_gray"])
    cyl("water_tank", 1.05, 1.05, 1.70, (-W * 0.18, 0, 0.24 + H + 1.45),
        MAT["metal"], segs=12)
    box("roof_ac", (0.60, 0.48, 0.62), (W * 0.22, D * 0.20, 0.24 + H + 0.42),
        MAT["plaster_white"])

    export_current(name)
    return CUR_OBJS


def build_machiya():
    name = "res_machiya_2f"
    begin(name)
    W, D, FH = 7.6, 6.4, 2.95
    H = 2 * FH
    front = -D / 2
    box("base", (W + 0.30, D + 0.30, 0.22), (0, 0, 0.11), MAT["stone"])
    box("body", (W, D, H), (0, 0, 0.22 + H / 2), MAT["plaster_cream"])
    box("wood_band", (W + 0.05, D + 0.05, 2.10), (0, 0, 0.22 + 1.05), MAT["wood_mid"])
    for sx in (-1, 1):
        for sy in (-1, 1):
            box("post", (0.22, 0.22, H), (sx * (W / 2 - 0.01), sy * (D / 2 - 0.01),
                                         0.22 + H / 2), MAT["wood_dark"])
    lattice(W * 0.74, front - 0.12, 0.45, 2.20, MAT["wood_dark"], bars=13)
    box("door", (1.30, 0.14, 2.05), (W * 0.30, front - 0.10, 1.25), MAT["wood_dark"])
    box("slate", (W + 0.30, 1.55, 0.12), (0, front - 0.55, 2.86), MAT["tile_blue"],
        rot=(math.radians(-5), 0, 0))
    upper_window(front - 0.02, 0.22 + FH + 1.35, W, MAT["wood_dark"], "glass_cool")
    balcony(front, 0.22 + FH + 1.75, W, MAT["wood_dark"])
    box("win_back", (W * 0.30, 0.08, 1.05), (0, D / 2 + 0.02, 0.22 + FH + 1.35),
        MAT["glass_cool"])
    box("win_back", (W * 0.30, 0.08, 1.05), (0, D / 2 + 0.02, 1.55),
        MAT["glass_cool"])
    gable("roof", W, D, 2.05, MAT["tile_blue"], 0.22 + H, over=0.70)
    cyl("ridge", 0.11, 0.11, W + 1.40, (0, 0, 0.22 + H + 2.05),
        MAT["tile_black"], rot=(0, math.pi / 2, 0), segs=8)
    noren(W * 0.34, front - 0.34, 2.55, "cloth_indigo", "町家", 0.20)
    export_current(name)
    return CUR_OBJS


def build_torii():
    name = "lm_torii"
    begin(name)
    red = MAT["tile_red"]
    for sx in (-1, 1):
        cyl("pillar", 0.32, 0.40, 7.20, (sx * 3.60, 0, 3.60), red, segs=12)
        cyl("base", 0.46, 0.50, 0.34, (sx * 3.60, 0, 0.17), MAT["stone"], segs=12)
    box("kasagi", (9.40, 0.66, 0.46), (0, 0, 7.34), red)
    box("shimaki", (8.90, 0.72, 0.24), (0, 0, 6.99), red)
    box("nuki", (8.10, 0.44, 0.34), (0, 0, 5.86), red)
    box("gakuzuka", (0.46, 0.38, 1.05), (0, 0, 6.42), red)
    box("plaque", (1.10, 0.12, 0.62), (0, -0.30, 6.44), MAT["wood_dark"])
    text("plaque_text", "桜 町", 0.30, (0, -0.38, 6.44), MAT["gold"])
    for sx in (-1, 1):
        box("brace", (1.60, 0.20, 0.20), (sx * 2.10, 0, 5.30), red,
            rot=(0, math.radians(sx * 18), 0))
    export_current(name)
    return CUR_OBJS


def build_station():
    name = "lm_station"
    begin(name)
    box("deck", (26.0, 7.2, 0.60), (0, 0, 5.30), MAT["concrete"])
    box("deck_edge", (26.0, 0.30, 0.34), (0, -3.55, 5.55), MAT["plaster_gray"])
    for gx in (-11.0, -5.5, 0.0, 5.5, 11.0):
        box("column", (0.70, 0.70, 5.00), (gx, 0, 2.50), MAT["concrete"])
    box("canopy", (24.0, 6.60, 0.22), (0, 0, 9.10), MAT["plaster_gray"])
    for gx in (-9.0, -4.5, 0.0, 4.5, 9.0):
        cyl("canopy_post", 0.16, 0.16, 3.60, (gx, -2.60, 7.40), MAT["metal_dark"],
            segs=8)
    box("sign_band", (9.0, 0.16, 1.05), (0, -3.62, 8.20), MAT["sign_navy"])
    text("station_text", "桜 町 駅", 0.52, (0, -3.72, 8.20), MAT["lamp_white"])
    for i in range(5):
        box("platform_light", (0.28, 0.28, 0.16), (-8.0 + i * 4.0, 0, 9.28),
            MAT["lamp_white"])
    box("stair", (2.40, 1.40, 0.28), (0, -4.10, 4.90), MAT["concrete"])
    box("stair", (2.40, 1.40, 0.28), (0, -5.40, 4.20), MAT["concrete"])
    box("stair", (2.40, 1.40, 0.28), (0, -6.70, 3.50), MAT["concrete"])
    box("stair", (2.40, 1.40, 0.28), (0, -8.00, 2.80), MAT["concrete"])
    export_current(name)
    return CUR_OBJS


def build_train():
    name = "lm_train"
    begin(name)
    box("carbody", (15.6, 2.86, 2.60), (0, 0, 1.72), MAT["plaster_white"])
    box("stripe", (15.6, 2.90, 0.34), (0, 0, 1.10), MAT["sign_green"])
    for i in range(8):
        box("win", (1.05, 0.06, 0.92), (-6.3 + i * 1.78, -1.46, 2.34),
            MAT["glass_cool"])
        box("win", (1.05, 0.06, 0.92), (-6.3 + i * 1.78, 1.46, 2.34),
            MAT["glass_cool"])
    for gx in (-4.2, 4.2):
        box("door", (1.10, 2.92, 2.05), (gx, 0, 1.40), MAT["plaster_gray"])
    box("roof_cap", (15.2, 2.60, 0.18), (0, 0, 3.10), MAT["plaster_gray"])
    box("pantograph", (0.10, 0.10, 0.66), (-3.0, 0, 3.50), MAT["metal_dark"])
    box("pantograph_bar", (1.30, 0.08, 0.08), (-3.0, 0, 3.82), MAT["metal_dark"])
    for wx in (-5.2, -2.6, 2.6, 5.2):
        for wy in (-1.24, 1.24):
            cyl("wheel", 0.42, 0.42, 0.20, (wx, wy, 0.42), MAT["metal_dark"],
                rot=(math.pi / 2, 0, 0), segs=10)
    box("headlight", (0.24, 0.24, 0.20), (7.86, -0.90, 2.05), MAT["lamp_white"])
    box("headlight", (0.24, 0.24, 0.20), (7.86, 0.90, 2.05), MAT["lamp_white"])
    export_current(name)
    return CUR_OBJS


def build_arch():
    name = "lm_arch"
    begin(name)
    for sx in (-1, 1):
        cyl("pillar", 0.30, 0.34, 7.40, (sx * 5.00, 0, 3.70), MAT["metal_dark"],
            segs=10)
    box("beam", (11.20, 0.70, 1.62), (0, 0, 7.30), MAT["wood_dark"])
    box("beam_face", (10.40, 0.10, 1.28), (0, -0.38, 7.30), MAT["neon_pink"])
    text("arch_text", "桜 町 一 番 街", 0.78, (0, -0.46, 7.30), MAT["lamp_white"])
    for i in range(8):
        prop_lantern(-4.2 + i * 1.2, -0.52, 6.10, 0.80, "lamp_red")
    export_current(name)
    return CUR_OBJS


# ---------------------------------------------------------------- 车辆

def _wheels(positions, z=0.38, r=0.36):
    for wx, wy in positions:
        cyl("wheel", r, r, 0.22, (wx, wy, z), MAT["metal_dark"],
            rot=(math.pi / 2, 0, 0), segs=12)
        cyl("hub", r * 0.42, r * 0.42, 0.24, (wx, wy, z), MAT["metal"], segs=10)


def build_keitruck():
    """日本街头最常见的白色轻卡（軽トラ），车头在 +X。"""
    begin("veh_keitruck")
    box("cab", (1.55, 1.46, 1.28), (1.02, 0, 1.02), MAT["plaster_white"])
    box("windshield", (0.08, 1.30, 0.62), (1.79, 0, 1.36), MAT["glass_cool"])
    for sy in (-1, 1):
        box("side_win", (0.72, 0.06, 0.56), (1.02, sy * 0.74, 1.34), MAT["glass_cool"])
    box("bumper", (0.16, 1.50, 0.26), (1.84, 0, 0.52), MAT["metal_dark"])
    box("bed_floor", (2.10, 1.46, 0.14), (-0.62, 0, 0.62), MAT["metal"])
    for sy in (-1, 1):
        box("bed_wall", (2.10, 0.08, 0.42), (-0.62, sy * 0.72, 0.84), MAT["metal"])
    box("bed_tail", (0.08, 1.46, 0.42), (-1.68, 0, 0.84), MAT["metal"])
    box("headlight", (0.06, 0.26, 0.18), (1.86, -0.46, 0.86), MAT["lamp_white"])
    box("headlight", (0.06, 0.26, 0.18), (1.86, 0.46, 0.86), MAT["lamp_white"])
    _wheels([(1.15, -0.70), (1.15, 0.70), (-1.05, -0.70), (-1.05, 0.70)])
    export_current("veh_keitruck")
    return CUR_OBJS


def build_taxi():
    """东京常见的绿黄配色出租车。"""
    begin("veh_taxi")
    box("body", (4.40, 1.72, 0.78), (0, 0, 0.72), MAT["sign_green"])
    box("cabin", (2.20, 1.60, 0.74), (-0.12, 0, 1.46), MAT["plaster_white"])
    box("windshield", (0.10, 1.46, 0.60), (1.02, 0, 1.50), MAT["glass_cool"],
        rot=(0, math.radians(-16), 0))
    box("rear_glass", (0.10, 1.46, 0.58), (-1.22, 0, 1.50), MAT["glass_cool"],
        rot=(0, math.radians(16), 0))
    for sy in (-1, 1):
        box("side_win", (1.90, 0.06, 0.54), (-0.12, sy * 0.80, 1.52), MAT["glass_cool"])
    box("roof_sign", (0.34, 0.46, 0.20), (0.10, 0, 1.92), MAT["lamp_amber"]
        if "lamp_amber" in MAT else MAT["lamp_white"])
    box("bumper", (0.18, 1.74, 0.30), (2.22, 0, 0.58), MAT["metal_dark"])
    box("bumper", (0.18, 1.74, 0.30), (-2.22, 0, 0.58), MAT["metal_dark"])
    for sy in (-1, 1):
        box("headlight", (0.08, 0.30, 0.20), (2.21, sy * 0.56, 0.92), MAT["lamp_white"])
    _wheels([(1.42, -0.82), (1.42, 0.82), (-1.42, -0.82), (-1.42, 0.82)])
    export_current("veh_taxi")
    return CUR_OBJS


def build_bus():
    """粉白涂装的社区巴士。"""
    begin("veh_bus")
    box("body", (8.60, 2.30, 2.10), (0, 0, 1.42), MAT["plaster_white"])
    box("stripe", (8.62, 2.34, 0.38), (0, 0, 0.78), MAT["neon_pink"])
    for i in range(6):
        box("win", (1.06, 0.06, 0.78), (-2.75 + i * 1.12, -1.16, 2.02),
            MAT["glass_cool"])
        box("win", (1.06, 0.06, 0.78), (-2.75 + i * 1.12, 1.16, 2.02),
            MAT["glass_cool"])
    box("door", (1.05, 2.32, 1.72), (2.95, 0, 1.28), MAT["glass_cool"])
    box("windshield", (0.10, 2.10, 0.92), (4.30, 0, 1.90), MAT["glass_cool"])
    box("roof_box", (2.10, 1.40, 0.30), (-1.90, 0, 2.60), MAT["plaster_gray"])
    for sy in (-1, 1):
        box("headlight", (0.08, 0.34, 0.22), (4.30, sy * 0.72, 0.86),
            MAT["lamp_white"])
    _wheels([(2.70, -1.04), (2.70, 1.04), (-2.40, -1.04), (-2.40, 1.04)], z=0.44, r=0.44)
    export_current("veh_bus")
    return CUR_OBJS



# ---------------------------------------------------------------- 街道家具

def prop_nobori(x, y, z, cloth="cloth_red", body="営業中"):
    cyl("nobori_pole", 0.035, 0.035, 2.60, (x, y, z + 1.30), MAT["metal_dark"], segs=6)
    box("nobori_flag", (0.02, 0.44, 1.34), (x + 0.02, y + 0.24, z + 1.70), MAT[cloth])
    box("nobori_bar", (0.03, 0.48, 0.04), (x + 0.02, y + 0.24, z + 2.38),
        MAT["metal_dark"])
    text("nobori_text", body, 0.15, (x + 0.04, y + 0.24, z + 1.70),
         MAT["cloth_white"], rot=(math.pi / 2, 0, math.pi / 2))


def build_prop_pole():
    begin("prop_pole")
    cyl("pole", 0.13, 0.17, 9.40, (0, 0, 4.70), MAT["concrete"], segs=10)
    for zz in (7.10, 8.10):
        box("crossarm", (1.90, 0.10, 0.10), (0, 0, zz), MAT["metal_dark"])
        for ox in (-0.78, -0.36, 0.36, 0.78):
            cyl("insulator", 0.055, 0.055, 0.16, (ox, 0, zz + 0.13),
                MAT["plaster_gray"], segs=6)
    cyl("transformer", 0.26, 0.26, 0.78, (0.38, 0, 6.10), MAT["metal"], segs=10)
    box("transformer_arm", (0.60, 0.10, 0.08), (0.30, 0, 5.70), MAT["metal_dark"])
    for zz in (4.60, 5.10, 5.60):
        box("step_bolt", (0.45, 0.05, 0.04), (0, 0, zz), MAT["metal_dark"])
    cyl("lamp_arm", 0.045, 0.045, 1.30, (0.62, 0, 7.60), MAT["metal_dark"],
        rot=(0, math.pi / 2, 0), segs=6)
    box("lamp_head", (0.44, 0.20, 0.12), (1.26, 0, 7.56), MAT["lamp_white"])
    export_current("prop_pole")
    return CUR_OBJS


def build_prop_lamp():
    begin("prop_lamp")
    cyl("post", 0.08, 0.10, 4.60, (0, 0, 2.30), MAT["metal_dark"], segs=8)
    cyl("base", 0.20, 0.22, 0.16, (0, 0, 0.08), MAT["concrete"], segs=10)
    cyl("arm", 0.05, 0.05, 1.05, (0.50, 0, 4.55), MAT["metal_dark"],
        rot=(0, math.pi / 2, 0), segs=6)
    box("head", (0.62, 0.26, 0.14), (1.02, 0, 4.50), MAT["metal_dark"])
    box("glass", (0.54, 0.20, 0.06), (1.02, 0, 4.42), MAT["lamp_white"])
    export_current("prop_lamp")
    return CUR_OBJS


def build_prop_mailbox():
    begin("prop_mailbox")
    cyl("body", 0.26, 0.26, 1.20, (0, 0, 0.72), MAT["sign_red"], segs=12)
    cyl("base", 0.16, 0.18, 0.14, (0, 0, 0.07), MAT["metal_dark"], segs=10)
    cyl("cap", 0.29, 0.20, 0.18, (0, 0, 1.41), MAT["sign_red"], segs=12)
    box("slot", (0.34, 0.05, 0.10), (0, -0.25, 1.16), MAT["metal_dark"])
    box("label", (0.18, 0.03, 0.22), (0, -0.26, 0.96), MAT["plaster_white"])
    export_current("prop_mailbox")
    return CUR_OBJS


def build_prop_hydrant():
    begin("prop_hydrant")
    cyl("base", 0.16, 0.18, 0.12, (0, 0, 0.06), MAT["metal_dark"], segs=10)
    cyl("body", 0.12, 0.13, 0.50, (0, 0, 0.36), MAT["sign_red"], segs=10)
    cyl("top", 0.09, 0.13, 0.12, (0, 0, 0.66), MAT["sign_red"], segs=10)
    cyl("nozzle", 0.05, 0.05, 0.18, (0.14, 0, 0.44), MAT["sign_red"],
        rot=(0, math.pi / 2, 0), segs=6)
    cyl("nozzle", 0.05, 0.05, 0.18, (-0.14, 0, 0.44), MAT["sign_red"],
        rot=(0, math.pi / 2, 0), segs=6)
    export_current("prop_hydrant")
    return CUR_OBJS


def build_prop_mirror():
    begin("prop_mirror")
    cyl("post", 0.06, 0.07, 3.10, (0, 0, 1.55), MAT["metal_dark"], segs=8)
    cyl("mirror_rim", 0.44, 0.44, 0.06, (0, -0.10, 3.02), MAT["canvas_green"],
        rot=(math.pi / 2, 0, 0), segs=14)
    cyl("mirror_glass", 0.39, 0.39, 0.03, (0, -0.14, 3.02), MAT["glass_cool"],
        rot=(math.pi / 2, 0, 0), segs=14)
    box("mirror_arm", (0.07, 0.34, 0.07), (0, -0.02, 3.02), MAT["metal_dark"])
    export_current("prop_mirror")
    return CUR_OBJS


def build_prop_bollard():
    begin("prop_bollard")
    cyl("post", 0.07, 0.08, 0.92, (0, 0, 0.46), MAT["metal_dark"], segs=8)
    cyl("band", 0.075, 0.075, 0.12, (0, 0, 0.74), MAT["lamp_white"], segs=8)
    cyl("head", 0.09, 0.07, 0.08, (0, 0, 0.94), MAT["metal_dark"], segs=8)
    export_current("prop_bollard")
    return CUR_OBJS


def build_prop_cone():
    begin("prop_cone")
    box("base", (0.34, 0.34, 0.04), (0, 0, 0.02), MAT["sign_red"])
    cyl("body", 0.13, 0.05, 0.62, (0, 0, 0.33), MAT["sign_red"], segs=8)
    cyl("band", 0.105, 0.095, 0.10, (0, 0, 0.36), MAT["plaster_white"], segs=8)
    export_current("prop_cone")
    return CUR_OBJS


def build_prop_stop():
    begin("prop_stop")
    cyl("post", 0.045, 0.05, 2.30, (0, 0, 1.15), MAT["metal_dark"], segs=8)
    box("plate", (0.02, 0.62, 0.56), (0.02, 0, 1.86), MAT["plaster_white"])
    box("plate_edge", (0.02, 0.66, 0.60), (0.01, 0, 1.86), MAT["sign_red"])
    text("stop_text", "止まれ", 0.20, (0.04, 0, 1.90), MAT["sign_red"],
         rot=(math.pi / 2, 0, math.pi / 2))
    export_current("prop_stop")
    return CUR_OBJS


def build_prop_bikerack():
    begin("prop_bikerack")
    for ox in (-0.50, 0.0, 0.50):
        torus("hoop", 0.26, 0.03, (ox, 0, 0.30), MAT["metal"],
              rot=(0, math.pi / 2, 0), seg_major=10, seg_minor=4)
    box("rail", (1.40, 0.06, 0.05), (0, 0, 0.06), MAT["metal_dark"])
    export_current("prop_bikerack")
    return CUR_OBJS


def build_prop_trash():
    begin("prop_trash")
    box("bin_a", (0.40, 0.40, 0.72), (-0.24, 0, 0.40), MAT["metal"])
    box("bin_b", (0.40, 0.40, 0.72), (0.24, 0, 0.40), MAT["canvas_blue"])
    box("lid_a", (0.44, 0.44, 0.06), (-0.24, 0, 0.79), MAT["metal_dark"])
    box("lid_b", (0.44, 0.44, 0.06), (0.24, 0, 0.79), MAT["metal_dark"])
    export_current("prop_trash")
    return CUR_OBJS


def build_prop_manhole():
    begin("prop_manhole")
    cyl("cover", 0.46, 0.46, 0.04, (0, 0, 0.02), MAT["metal_dark"], segs=16)
    cyl("ring", 0.54, 0.54, 0.03, (0, 0, 0.015), MAT["concrete"], segs=16)
    for i in range(4):
        box("rib", (0.72, 0.05, 0.03), (0, 0, 0.045), MAT["metal"],
            rot=(0, 0, i * math.pi / 4))
    export_current("prop_manhole")
    return CUR_OBJS


def build_prop_guardrail():
    begin("prop_guardrail")
    for ox in (-0.90, 0.90):
        cyl("post", 0.045, 0.05, 0.92, (ox, 0, 0.46), MAT["metal"], segs=8)
    box("rail_top", (1.96, 0.06, 0.05), (0, 0, 0.88), MAT["metal"])
    box("rail_mid", (1.96, 0.05, 0.04), (0, 0, 0.52), MAT["metal"])
    for ox in (-0.60, -0.20, 0.20, 0.60):
        box("picket", (0.035, 0.04, 0.52), (ox, 0, 0.62), MAT["metal"])
    export_current("prop_guardrail")
    return CUR_OBJS


def build_prop_vending():
    begin("prop_vending")
    prop_vending(0, 0, 0, "sign_red")
    export_current("prop_vending")
    return CUR_OBJS


def build_prop_signal():
    begin("prop_signal")
    cyl("post", 0.09, 0.11, 5.20, (0, 0, 2.60), MAT["metal_dark"], segs=8)
    cyl("arm", 0.06, 0.06, 2.40, (1.20, 0, 5.05), MAT["metal_dark"],
        rot=(0, math.pi / 2, 0), segs=6)
    box("housing", (0.34, 1.20, 0.42), (2.28, 0, 4.86), MAT["metal_dark"])
    for oy, matname in ((-0.38, "lamp_red"), (0.0, "lamp_white"),
                        (0.38, "sign_green")):
        cyl("lamp", 0.15, 0.15, 0.10, (2.44, oy, 4.86), MAT[matname],
            rot=(0, math.pi / 2, 0), segs=10)
    box("ped_housing", (0.28, 0.26, 0.62), (0.22, 0, 3.10), MAT["metal_dark"])
    export_current("prop_signal")
    return CUR_OBJS


# ---------------------------------------------------------------- 预览渲染

def add_preview_env():
    scene = bpy.context.scene
    plane_me = bpy.data.meshes.new("ground")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=90)
    bm.to_mesh(plane_me)
    bm.free()
    ground = bpy.data.objects.new("ground", plane_me)
    plane_me.materials.append(MAT["ground"])
    ground.location = (0, -6, -0.02)
    scene.collection.objects.link(ground)

    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = (0.84, 0.87, 0.90, 1)
    bg.inputs[1].default_value = 1.0
    scene.world = world

    sun_data = bpy.data.lights.new("Sun", 'SUN')
    sun_data.energy = 3.4
    sun_data.angle = math.radians(3)
    sun = bpy.data.objects.new("Sun", sun_data)
    sun.rotation_euler = (math.radians(52), 0, math.radians(-38))
    scene.collection.objects.link(sun)

    fill_data = bpy.data.lights.new("Fill", 'AREA')
    fill_data.energy = 900
    fill_data.size = 26
    fill = bpy.data.objects.new("Fill", fill_data)
    fill.location = (0, -22, 16)
    fill.rotation_euler = (math.radians(64), 0, 0)
    scene.collection.objects.link(fill)


def render_to(path, loc, target, lens=52, res=(1600, 900)):
    scene = bpy.context.scene
    for engine in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = lens
    cam = bpy.data.objects.new("Cam", cam_data)
    cam.location = loc
    direction = Vector(target) - Vector(loc)
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam

    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.filepath = path
    scene.render.image_settings.file_format = 'PNG'
    try:
        scene.eevee.taa_render_samples = 24
    except Exception:
        pass

    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    print("render ->", path)


def build_preview_scene():
    """把 2F 商铺排成一排，后面摆住宅与地标，供出图用。"""
    keys = ["konbini", "ramen", "izakaya", "cafe", "bookstore", "sushi",
            "drugstore", "arcade", "machiya", "sento", "kappo", "yatai"]
    for idx, key in enumerate(keys):
        objs = PREVIEW.get(key)
        if not objs:
            continue
        offset_x = (idx - 5.5) * 8.4
        offset_y = 0.0
        for ob in objs:
            ob.location = (ob.location.x + offset_x,
                           ob.location.y + offset_y,
                           ob.location.z)

    for idx, key in enumerate(("res_danchi_4f", "res_machiya_2f", "lm_torii")):
        objs = PREVIEW.get(key)
        if not objs:
            continue
        offset_x = -34 + idx * 26
        for ob in objs:
            ob.location = (ob.location.x + offset_x,
                           ob.location.y + 15.0,
                           ob.location.z)

    for ob in PREVIEW.get("lm_arch", []):
        ob.location = (ob.location.x + 30, ob.location.y + 15.0, ob.location.z)


# ---------------------------------------------------------------- 主流程

def main():
    reset_scene()
    load_font()
    build_materials()

    for cfg in STYLES:
        for floors in (2, 3):
            objs = build_shop(cfg, floors)
            if floors == 2:
                PREVIEW[cfg["key"]] = objs
            else:
                hide(objs, True)

    yatai = build_shop(dict(STYLES[11], key="yatai1"), 1)
    PREVIEW["yatai1"] = yatai
    hide(yatai, True)

    for floors in (3, 4):
        objs = build_danchi(floors)
        if floors == 4:
            PREVIEW["res_danchi_4f"] = objs
        else:
            hide(objs, True)

    machiya = build_machiya()
    PREVIEW["res_machiya_2f"] = machiya

    PREVIEW["lm_torii"] = build_torii()
    hide(PREVIEW["lm_torii"], True)
    PREVIEW["lm_station"] = build_station()
    hide(PREVIEW["lm_station"], True)
    PREVIEW["lm_train"] = build_train()
    hide(PREVIEW["lm_train"], True)
    PREVIEW["lm_arch"] = build_arch()
    hide(PREVIEW["lm_arch"], True)

    for builder_fn in (build_keitruck, build_taxi, build_bus):
        hide(builder_fn(), True)

    for builder_fn in (build_prop_pole, build_prop_lamp, build_prop_mailbox,
                       build_prop_hydrant, build_prop_mirror, build_prop_bollard,
                       build_prop_cone, build_prop_stop, build_prop_bikerack,
                       build_prop_trash, build_prop_manhole, build_prop_guardrail,
                       build_prop_vending, build_prop_signal):
        hide(builder_fn(), True)

    add_preview_env()
    build_preview_scene()

    render_to(os.path.join(PREVIEW_DIR, "kit_shops.png"),
              (0, -78, 30), (0, 0, 5.5), lens=42)
    render_to(os.path.join(PREVIEW_DIR, "kit_shop_closeup.png"),
              (-14, -18, 7.5), (-14, 0, 4.0), lens=40)
    render_to(os.path.join(PREVIEW_DIR, "kit_landmarks.png"),
              (-2, -34, 14), (-4, 14, 5.0), lens=40)

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    print("saved blend ->", BLEND_PATH)
    print("done")


main()
