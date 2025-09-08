function RoomEnvironment() {
    const scene = new THREE.Scene();

    const geometry = new THREE.BoxBufferGeometry();
    geometry.deleteAttribute('uv');

    const roomMaterial = new THREE.MeshStandardMaterial({ side: THREE.BackSide });
    const boxMaterial = new THREE.MeshStandardMaterial();

    // 主光
    const mainLight = new THREE.PointLight(0xffffff, 5.0, 28, 2);
    mainLight.position.set(0.418, 16.199, 0.300);
    scene.add(mainLight);

    // 房间
    const room = new THREE.Mesh(geometry, roomMaterial);
    room.position.set(-0.757, 13.219, 0.717);
    room.scale.set(31.713, 28.305, 28.591);
    scene.add(room);

    // 六个箱子
    const boxes = [
        { pos: [-10.906, 2.009, 1.846], rot: [0, -0.195, 0], scale: [2.328, 7.905, 4.651] },
        { pos: [-5.607, -0.754, -0.758], rot: [0, 0.994, 0], scale: [1.97, 1.534, 3.955] },
        { pos: [6.167, 0.857, 7.803], rot: [0, 0.561, 0], scale: [3.927, 6.285, 3.687] },
        { pos: [-2.017, 0.018, 6.124], rot: [0, 0.333, 0], scale: [2.002, 4.566, 2.064] },
        { pos: [2.291, -0.756, -2.621], rot: [0, -0.286, 0], scale: [1.546, 1.552, 1.496] },
        { pos: [-2.193, -0.369, -5.547], rot: [0, 0.516, 0], scale: [3.875, 3.487, 2.986] },
    ];

    boxes.forEach(b => {
        const box = new THREE.Mesh(geometry, boxMaterial);
        box.position.set(...b.pos);
        box.rotation.set(...b.rot);
        box.scale.set(...b.scale);
        scene.add(box);
    });

    // 六个区域光
    const lights = [
        { pos: [-16.116, 14.37, 8.208], scale: [0.1, 2.428, 2.739], intensity: 50 },
        { pos: [-16.109, 18.021, -8.207], scale: [0.1, 2.425, 2.751], intensity: 50 },
        { pos: [14.904, 12.198, -1.832], scale: [0.15, 4.265, 6.331], intensity: 17 },
        { pos: [-0.462, 8.89, 14.52], scale: [4.38, 5.441, 0.088], intensity: 43 },
        { pos: [3.235, 11.486, -12.541], scale: [2.5, 2.0, 0.1], intensity: 20 },
        { pos: [0.0, 20.0, 0.0], scale: [1.0, 0.1, 1.0], intensity: 100 },
    ];

    lights.forEach(l => {
        const lightMesh = new THREE.Mesh(
            geometry,
            new THREE.MeshBasicMaterial({ color: new THREE.Color(l.intensity, l.intensity, l.intensity) })
        );
        lightMesh.position.set(...l.pos);
        lightMesh.scale.set(...l.scale);
        scene.add(lightMesh);
    });

    // 返回这个内部 Scene，用于生成 PMREM
    return scene;
}

// 生成 PMREM 环境贴图
RoomEnvironment.generatePMREM = function(renderer) {
    const envScene = RoomEnvironment();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileCubemapShader();
    const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
    pmremGenerator.dispose();
    return envMap;
};