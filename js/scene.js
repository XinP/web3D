class SceneManager {
    constructor() {
        this.scene = null;
        this.renderer = null;
        this.axesHelper = null;
        this.init();
    }

    init() {
        // 创建场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222222);

        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // 添加到DOM
        document.getElementById('container').appendChild(this.renderer.domElement);

        // 添加坐标轴辅助器
        this.axesHelper = new THREE.AxesHelper(5);
        this.scene.add(this.axesHelper);

        // 监听窗口大小变化
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
    }

    onWindowResize() {
        if (window.cameraManager) {
            window.cameraManager.camera.aspect = window.innerWidth / window.innerHeight;
            window.cameraManager.camera.updateProjectionMatrix();
        }
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render(camera) {
        this.renderer.render(this.scene, camera);
    }

    add(object) {
        this.scene.add(object);
    }

    remove(object) {
        this.scene.remove(object);
    }
}