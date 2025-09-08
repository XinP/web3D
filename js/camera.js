class CameraManager {
    constructor(scene, renderer) {
        this.camera = null;
        this.controls = null;
        this.scene = scene;
        this.renderer = renderer;
        this.viewPresets = {}; // 新增：预设视角
        this.init();
    }

    init() {
        // 创建透视摄像机
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );

        // 设置摄像机位置
        this.camera.position.set(10, 10, 10);
        this.camera.lookAt(0, 0, 0);

        // 创建轨道控制器
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = true;
        this.controls.enablePan = true;
        this.controls.enableRotate = true;

        // 设置控制器限制
        this.controls.maxDistance = 50;
        this.controls.minDistance = 2;
        this.controls.maxPolarAngle = Math.PI;

        // 初始化预设视角
        this.initViewPresets();
    }

    // 新增：初始化预设视角
    initViewPresets() {
        this.viewPresets = {
            front: { position: { x: 0, y: 0, z: 20 }, target: { x: 0, y: 0, z: 0 } },
            back: { position: { x: 0, y: 0, z: -20 }, target: { x: 0, y: 0, z: 0 } },
            left: { position: { x: -20, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } },
            right: { position: { x: 20, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } },
            top: { position: { x: 0, y: 20, z: 0 }, target: { x: 0, y: 0, z: 0 } },
            bottom: { position: { x: 0, y: -20, z: 0 }, target: { x: 0, y: 0, z: 0 } },
            isometric: { position: { x: 15, y: 15, z: 15 }, target: { x: 0, y: 0, z: 0 } }
        };
    }

    // 新增：切换到预设视角
    setView(viewName, duration = 1000) {
        const preset = this.viewPresets[viewName];
        if (!preset) {
            console.warn(`视角 ${viewName} 不存在`);
            return false;
        }

        this.animateToPosition(
            preset.position,
            preset.target,
            duration
        );
        return true;
    }

    // 新增：动画切换摄像机位置
    animateToPosition(targetPosition, targetLookAt, duration = 1000) {
        const startPosition = this.camera.position.clone();
        const startTarget = this.controls.target.clone();

        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 使用缓动函数
            const easeProgress = this.easeInOutCubic(progress);

            // 插值位置
            this.camera.position.lerpVectors(startPosition,
                new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z),
                easeProgress
            );

            // 插值目标
            this.controls.target.lerpVectors(startTarget,
                new THREE.Vector3(targetLookAt.x, targetLookAt.y, targetLookAt.z),
                easeProgress
            );

            this.controls.update();

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    // 新增：缓动函数
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    }

    // 新增：获取当前摄像机状态
    getCameraState() {
        return {
            position: this.camera.position.clone(),
            target: this.controls.target.clone(),
            zoom: this.camera.zoom
        };
    }

    // 新增：设置自定义视角
    setCustomView(position, target, duration = 1000) {
        this.animateToPosition(position, target, duration);
    }

    update() {
        if (this.controls) {
            this.controls.update();
        }
    }

    setPosition(x, y, z) {
        this.camera.position.set(x, y, z);
    }

    lookAt(x, y, z) {
        this.camera.lookAt(x, y, z);
    }
}