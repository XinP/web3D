class LightingManager {
    constructor(scene, renderer) {
        this.scene = scene;
        this.ambientLight = null;
        this.directionalLight = null;
        this.renderer = renderer;
        this.init();
    }

    init() {
        // 环境光
        this.ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(this.ambientLight);

        // 方向光（主光源）
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        this.directionalLight.position.set(0.2837, 0.3385, -0.8972);
        this.directionalLight.castShadow = true;

        // 设置阴影属性
        this.directionalLight.shadow.mapSize.width = 2048;
        this.directionalLight.shadow.mapSize.height = 2048;
        this.directionalLight.shadow.camera.near = 0.5;
        this.directionalLight.shadow.camera.far = 50;
        this.directionalLight.shadow.camera.left = -10;
        this.directionalLight.shadow.camera.right = 10;
        this.directionalLight.shadow.camera.top = 10;
        this.directionalLight.shadow.camera.bottom = -10;

        this.scene.add(this.directionalLight);

        // 方向光
        const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1);
        this.directionalLight.position.set(-0.2837, -0.3385, 0.8972);
        this.directionalLight.castShadow = true;

        this.scene.add(directionalLight1);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1);
        this.directionalLight.position.set(0.0000, -0.9356, -0.3530);
        this.directionalLight.castShadow = true;
        this.scene.add(directionalLight2);

        const directionalLight3 = new THREE.DirectionalLight(0xffffff, 1);
        this.directionalLight.position.set(0.0000, 0.9356, 0.3530);
        this.directionalLight.castShadow = true;
        this.scene.add(directionalLight3);

        //const renderer = this.scene.renderer;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        container.appendChild(this.renderer.domElement);


        this.scene.background = new THREE.Color(0xbbbbbb);
        this.scene.environment = RoomEnvironment.generatePMREM(this.renderer);
    }

    setAmbientIntensity(intensity) {
        this.ambientLight.intensity = intensity;
    }

    setDirectionalIntensity(intensity) {
        this.directionalLight.intensity = intensity;
    }

    setPointIntensity(intensity) {
        this.pointLight.intensity = intensity;
    }
}