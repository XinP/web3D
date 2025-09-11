import os
import numpy as np
import open3d as o3d
import trimesh
import math

# ---------------- 可调参数 ----------------
MIN_FACE_AREA = 1e-6       # 删除面积小于此阈值的三角面
MERGE_DISTANCE = 1e-5      # 顶点焊接阈值（世界单位）
SIMPLIFY_KEEP_RATIO = None # 如果设置为 0<x<1 -> 保留该比例的面（例如 0.2 保留 20%）
SIMPLIFY_TARGET_FACES = None  # 如果设置则以目标面数简化（优先于上面）
TAUBIN_ITERS = 20          # Taubin 平滑迭代次数（0 表示不做）
TAUBIN_LAMB = 0.5
TAUBIN_MU = -0.53
ENSURE_WATERTIGHT = True   # 是否在导出前尝试填洞/修复以保证 watertight
FIX_COORDINATE = True
# -----------------------------------------

def _compute_digits_for_weld(mesh_diag, weld_distance):
    """把绝对距离转换为 merge_vertices 使用的小数位数估计"""
    if weld_distance <= 0 or mesh_diag <= 0:
        return 6
    val = -math.log10(weld_distance / mesh_diag)
    digits = max(0, int(math.ceil(val)))
    return digits

def optimize_single_mesh(path,
                         min_face_area=MIN_FACE_AREA,
                         merge_distance=MERGE_DISTANCE,
                         simplify_keep_ratio=SIMPLIFY_KEEP_RATIO,
                         simplify_target_faces=SIMPLIFY_TARGET_FACES,
                         taubin_iters=TAUBIN_ITERS,
                         taubin_lamb=TAUBIN_LAMB,
                         taubin_mu=TAUBIN_MU,
                         ensure_watertight=ENSURE_WATERTIGHT,
                         fix_coordinate=FIX_COORDINATE):
    """
    处理单个文件（Open3D -> Trimesh），并返回处理后的 trimesh.Trimesh 对象。
    """
    mesh_o3d = o3d.io.read_triangle_mesh(path)
    if mesh_o3d is None or len(mesh_o3d.triangles) == 0:
        raise RuntimeError(f"无法加载或网格为空: {path}")

    verts = np.asarray(mesh_o3d.vertices)
    if verts.size == 0:
        raise RuntimeError("顶点为空")

    # 记录原始质心（保持位置不变）
    orig_centroid = np.mean(verts, axis=0)

    # ---------------- 1) 删除过小面 ----------------
    triangles = np.asarray(mesh_o3d.triangles)
    if len(triangles) > 0 and min_face_area is not None and min_face_area > 0:
        v = np.asarray(mesh_o3d.vertices)
        a = v[triangles[:,1]] - v[triangles[:,0]]
        b = v[triangles[:,2]] - v[triangles[:,0]]
        areas = 0.5 * np.linalg.norm(np.cross(a, b), axis=1)
        keep_mask = areas > min_face_area
        if np.count_nonzero(keep_mask) == 0:
            # 防止把所有面删光，保留原样
            print("警告: 删除小面后没有剩余三角形，跳过删除步骤。")
        else:
            mesh_o3d.triangles = o3d.utility.Vector3iVector(triangles[keep_mask])

    # ---------------- 2) 合并接近顶点 ----------------
    try:
        # merge_close_vertices 返回一个新的 mesh（某些版本）
        mesh_o3d = mesh_o3d.merge_close_vertices(merge_distance)
    except Exception:
        try:
            mesh_o3d.remove_duplicated_vertices()
            mesh_o3d.remove_unreferenced_vertices()
        except Exception:
            pass

    # ---------------- 3) 简化 ----------------
    curr_faces = len(np.asarray(mesh_o3d.triangles))
    if simplify_target_faces is not None and simplify_target_faces > 0 and curr_faces > simplify_target_faces:
        try:
            mesh_o3d = mesh_o3d.simplify_quadric_decimation(simplify_target_faces)
        except Exception:
            # 退回到顶点聚类
            voxel_size = np.mean(mesh_o3d.get_max_bound() - mesh_o3d.get_min_bound()) / (2 * np.sqrt(simplify_target_faces))
            mesh_o3d = mesh_o3d.simplify_vertex_clustering(voxel_size=voxel_size,
                                                           contraction=o3d.geometry.SimplificationContraction.Average)
    elif simplify_keep_ratio is not None and 0 < simplify_keep_ratio < 1:
        target_faces = max(4, int(curr_faces * simplify_keep_ratio))
        if target_faces < curr_faces:
            try:
                mesh_o3d = mesh_o3d.simplify_quadric_decimation(target_faces)
            except Exception:
                voxel_size = np.mean(mesh_o3d.get_max_bound() - mesh_o3d.get_min_bound()) / (2 * np.sqrt(target_faces))
                mesh_o3d = mesh_o3d.simplify_vertex_clustering(voxel_size=voxel_size,
                                                               contraction=o3d.geometry.SimplificationContraction.Average)

    # ---------------- 4) 在 Open3D 端计算法线 ----------------
    mesh_o3d.compute_triangle_normals()
    mesh_o3d.compute_vertex_normals()

    # ---------------- 5) 转为 Trimesh 进一步处理 ----------------
    verts = np.asarray(mesh_o3d.vertices)
    faces = np.asarray(mesh_o3d.triangles)
    mesh_tm = trimesh.Trimesh(vertices=verts, faces=faces, process=False)

    # 记录 diag 用于后续焊接位数估算
    diag = np.linalg.norm(mesh_tm.bounds[1] - mesh_tm.bounds[0])

    # Taubin 平滑（在 trimesh 上做，避免 Open3D 的过滤带来的偏移）
    if taubin_iters and taubin_iters > 0:
        try:
            trimesh.smoothing.filter_taubin(mesh_tm, lamb=taubin_lamb, nu=taubin_mu, iterations=taubin_iters)
        except Exception as e:
            print("Taubin 平滑失败（尝试 Laplacian）:", e)
            try:
                trimesh.smoothing.filter_laplacian(mesh_tm, lamb=taubin_lamb, iterations=taubin_iters)
            except Exception:
                pass

    # 重新计算并确保顶点法线/面法线都可用（这一步非常关键）
    _ = mesh_tm.vertex_normals    # 触发计算
    _ = mesh_tm.face_normals

    # 再次焊接（基于 merge_distance 转换为 digits）
    try:
        digits = _compute_digits_for_weld(diag, merge_distance)
        # 一些 trimesh 版本提供 merge_vertices(digits_vertex=digits)
        try:
            mesh_tm.merge_vertices(digits_vertex=digits)
        except Exception:
            # fallback：trimesh.grouping.merge_vertices
            try:
                trimesh.grouping.merge_vertices(mesh_tm, digits_vertex=digits)
            except Exception:
                pass
    except Exception:
        pass

    # 保证法线再次存在（万一 merge 改变了拓扑）
    _ = mesh_tm.vertex_normals

    # ---------------- 6) watertight 修复（可选） ----------------
    if ensure_watertight and not mesh_tm.is_watertight:
        try:
            trimesh.repair.fill_holes(mesh_tm)
            trimesh.repair.fix_normals(mesh_tm)
        except Exception:
            # 尝试更温和的修复
            try:
                trimesh.repair.fix_winding(mesh_tm)
            except Exception:
                pass

    # 将质心复位到原始质心，避免位置漂移
    try:
        new_centroid = mesh_tm.centroid
        delta = orig_centroid - new_centroid
        mesh_tm.vertices += delta
    except Exception:
        pass

    if fix_coordinate:
        R = trimesh.transformations.rotation_matrix(
            np.radians(-90), [1, 0, 0]
        )
        mesh_tm.apply_transform(R)

    # 强制触发 normals 的最终计算（确保导出时包含）
    _ = mesh_tm.vertex_normals
    _ = mesh_tm.face_normals

    return mesh_tm


def batch_process_folder(input_folder, output_folder,
                         min_face_area=MIN_FACE_AREA,
                         merge_distance=MERGE_DISTANCE,
                         simplify_keep_ratio=SIMPLIFY_KEEP_RATIO,
                         simplify_target_faces=SIMPLIFY_TARGET_FACES,
                         taubin_iters=TAUBIN_ITERS,
                         taubin_lamb=TAUBIN_LAMB,
                         taubin_mu=TAUBIN_MU,
                         ensure_watertight=ENSURE_WATERTIGHT):
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)

    for root, _, files in os.walk(input_folder):
        for f in files:
            if not f.lower().endswith((".stl", ".obj", ".ply", ".off", ".glb", ".gltf")):
                continue
            path = os.path.join(root, f)
            name = os.path.splitext(f)[0]
            print(f"\n处理: {path}")
            try:
                mesh_tm = optimize_single_mesh(
                    path,
                    min_face_area=min_face_area,
                    merge_distance=merge_distance,
                    simplify_keep_ratio=simplify_keep_ratio,
                    simplify_target_faces=simplify_target_faces,
                    taubin_iters=taubin_iters,
                    taubin_lamb=taubin_lamb,
                    taubin_mu=taubin_mu,
                    ensure_watertight=ensure_watertight
                )

                out_path = os.path.join(output_folder, f"{name}.glb")
                # 导出 glb 时，trimesh 会把 vertex_normals 一并写入（如果存在）
                mesh_tm.export(out_path, file_type="glb")
                print(f"导出完成 -> {out_path} (顶点 {len(mesh_tm.vertices)}, 面 {len(mesh_tm.faces)})")
            except Exception as e:
                print("处理失败:", e)


if __name__ == "__main__":
    INPUT_DIR = "demo/input"
    OUTPUT_DIR = "demo/output"

    batch_process_folder(
        INPUT_DIR,
        OUTPUT_DIR,
        min_face_area=1e-6,
        merge_distance=1e-5,
        simplify_keep_ratio=0.5,   # 保留 50% 面 (可改), 或者设置 simplify_target_faces=5000
        simplify_target_faces=None,
        taubin_iters=20,
        taubin_lamb=0.5,
        taubin_mu=-0.53,
        ensure_watertight=True
    )
