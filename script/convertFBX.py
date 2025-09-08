import os
import trimesh
import math
import numpy as np

def optimize_mesh_o3d(mesh, min_face_area=0.001, merge_distance=0.001, simplify_ratio=0.1):
    """
    使用 Open3D 对网格进行优化：删小面、焊接、简化、修法线
    """
    # 1. 删除过小的面
    triangles_to_keep = []
    vertices = np.asarray(mesh.vertices)
    triangles = np.asarray(mesh.triangles)

    for i, tri in enumerate(triangles):
        p1, p2, p3 = vertices[tri]
        area = 0.5 * np.linalg.norm(np.cross(p2 - p1, p3 - p1))
        if area > min_face_area:
            triangles_to_keep.append(i)

    if triangles_to_keep:
        mesh.triangles = o3d.utility.Vector3iVector(triangles[triangles_to_keep])
    else:
        print("⚠️ 所有面都被过滤掉了，保留原始网格")

    # 2. 合并接近的顶点
    mesh = mesh.merge_close_vertices(merge_distance)

    # 3. 简化（顶点聚类）
    if 0 < simplify_ratio < 1:
        target_faces = int(len(mesh.triangles) * (1 - simplify_ratio))
        if target_faces < 4:
            target_faces = max(4, len(mesh.triangles) // 2)
        voxel_size = np.mean(mesh.get_max_bound() - mesh.get_min_bound()) / (2 * np.sqrt(target_faces))
        mesh = mesh.simplify_vertex_clustering(
            voxel_size=voxel_size,
            contraction=o3d.geometry.SimplificationContraction.Average
        )

    # 4. 法线
    mesh.compute_vertex_normals()
    mesh.compute_triangle_normals()

    return mesh

                       
def get_solid_name(stl_path):
    """尝试解析 STL 文件中的 solid name"""
    name = os.path.splitext(os.path.basename(stl_path))[0]
    try:
        with open(stl_path, "r", errors="ignore") as f:
            first_line = f.readline().strip()
            if first_line.lower().startswith("solid"):
                parts = first_line.split(maxsplit=1)
                if len(parts) > 1:
                    return parts[1]
    except Exception:
        pass
    return name

def convert_and_merge_stl_to_gltf(input_folder, output_folder):
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)

    solid_groups = {}

    # 递归遍历所有 STL
    for root, _, files in os.walk(input_folder):
        for file in files:
            if file.lower().endswith(".stl"):
                stl_path = os.path.join(root, file)
                solid_name = get_solid_name(stl_path)

                mesh = trimesh.load(stl_path, force="mesh")
                if solid_name not in solid_groups:
                    solid_groups[solid_name] = []
                solid_groups[solid_name].append(mesh)

    # 合并并导出为 glTF (.glb)
    for solid_name, meshes in solid_groups.items():
        if len(meshes) > 1:
            merged = trimesh.util.concatenate(meshes)
        else:
            merged = meshes[0]

        glb_path = os.path.join(output_folder, f"{solid_name}.glb")

        try:
            merged.export(glb_path, file_type="glb")
            print(f"导出: {glb_path}")
        except Exception as e:
            print(f"导出 {solid_name}.glb 失败: {e}")

if __name__ == "__main__":
    input_dir = r"demo/input"
    output_dir = r"demo/output"
    convert_and_merge_stl_to_gltf(input_dir, output_dir)
