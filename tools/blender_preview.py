"""从已保存的 SakuraBlock_Kit.blend 出预览图，不重新建模。

用法：在 Blender 里 exec(open("tools/blender_preview.py").read())
"""

import bpy
import math
import os

from mathutils import Vector

BLEND_PATH = r"D:/Desktop/Game/assets/SakuraBlock_Kit.blend"
PREVIEW_DIR = r"D:/Desktop/Game/docs/preview"


def shoot(path, loc, target, lens=50, ortho=None, res=(1600, 900)):
    scene = bpy.context.scene
    for engine in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = lens
    if ortho:
        cam_data.type = 'ORTHO'
        cam_data.sensor_fit = 'HORIZONTAL'
        cam_data.ortho_scale = ortho
    cam = bpy.data.objects.new("Cam", cam_data)
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam

    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.filepath = path
    scene.render.image_settings.file_format = 'PNG'
    try:
        scene.eevee.taa_render_samples = 32
    except Exception:
        pass

    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    print("render ->", path)


bpy.ops.wm.open_mainfile(filepath=BLEND_PATH)


def toggle(prefixes, hidden):
    for col in bpy.data.collections:
        if any(col.name.startswith(p) for p in prefixes):
            col.hide_render = hidden


toggle(("res_", "lm_", "props_"), True)
shoot(os.path.join(PREVIEW_DIR, "kit_shops.png"),
      (0, -70, 6.0), (0, 0, 6.0), ortho=104, res=(1900, 820))
toggle(("res_", "lm_", "props_"), False)
shoot(os.path.join(PREVIEW_DIR, "kit_shop_closeup.png"),
      (-13, -16, 6.5), (-13, 0, 4.2), lens=42)
shoot(os.path.join(PREVIEW_DIR, "kit_overview.png"),
      (62, -52, 44), (0, 10, 4.0), lens=45)
print("preview done")
