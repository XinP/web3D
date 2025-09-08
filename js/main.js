class ThreeJSApp {
    constructor() {
        this.sceneManager = null;
        this.cameraManager = null;
        this.lightingManager = null;
        this.modelManager = null;
        this.api = null; // 新增API管理器
        this.init();
    }

    init() {
        // 初始化各个管理器
        this.sceneManager = new SceneManager();
        this.cameraManager = new CameraManager(this.sceneManager.scene, this.sceneManager.renderer);
        this.lightingManager = new LightingManager(this.sceneManager.scene, this.sceneManager.renderer);
        this.modelManager = new ModelManager(this.sceneManager.scene);

        // 初始化API接口
        this.api = new ThreeJSAPI(this);

        // 设置全局引用
        window.cameraManager = this.cameraManager;
        window.lightingManager = this.lightingManager;
        window.modelManager = this.modelManager;
        window.app = this;

        // 绑定控制器事件
        this.bindControls();
        this.bindViewControls(); // 新增视角控制

        // 开始渲染循环
        this.animate();

        console.log('Three.js 应用初始化完成');
    }

    // 新增：绑定视角控制
    bindViewControls() {
        // 添加视角切换按钮到控制面板
        const controlsDiv = document.getElementById('controls');

        const viewControlsHTML = `
            <div class="control-group">
                <label>摄像机视角:</label>
                <div class="view-buttons">
                    <button onclick="window.app.setView('front')">正视</button>
                    <button onclick="window.app.setView('back')">后视</button>
                    <button onclick="window.app.setView('left')">左视</button>
                    <button onclick="window.app.setView('right')">右视</button>
                    <button onclick="window.app.setView('top')">俯视</button>
                    <button onclick="window.app.setView('bottom')">仰视</button>
                    <button onclick="window.app.setView('isometric')">等轴测</button>
                </div>
            </div>
            <div class="control-group">
                <label>模型管理:</label>
                <div id="modelList"></div>
                <button onclick="window.app.showLoadModelDialog()">加载CDN模型</button>
            </div>
        `;

        controlsDiv.insertAdjacentHTML('beforeend', viewControlsHTML);

        // 更新模型列表
        this.updateModelList();
    }

    // 新增：更新模型列表显示
    updateModelList() {
        const modelListDiv = document.getElementById('modelList');
        const models = this.modelManager.getAllModels();

        modelListDiv.innerHTML = models.map(model => `
            <div class="model-item">
                <span>${model.id}</span>
                <button onclick="window.app.toggleModelVisibility('${model.id}')">
                    ${model.visible ? '隐藏' : '显示'}
                </button>
                <button onclick="window.app.removeModel('${model.id}')">删除</button>
            </div>
        `).join('');
    }

    // 新增：显示加载模型对话框
    showLoadModelDialog() {
        const cdnUrl = prompt('请输入CDN模型URL:');
        const modelId = prompt('请输入模型ID:');

        if (cdnUrl && modelId) {
            this.loadModelFromCDN(cdnUrl, modelId)
                .then(() => this.updateModelList())
                .catch(error => alert('模型加载失败: ' + error.message));
        }
    }

    // API方法封装
    async loadModelFromCDN(cdnUrl, modelId, position = { x: 0, y: 0, z: 0 }) {
        return await this.modelManager.downloadAndLoadModel(cdnUrl, modelId, position);
    }

    setView(viewName, duration = 1000) {
        return this.cameraManager.setView(viewName, duration);
    }

    toggleModelVisibility(modelId) {
        const model = this.modelManager.getModel(modelId);
        if (model) {
            this.modelManager.setModelVisibility(modelId, !model.visible);
            this.updateModelList();
        }
    }

    removeModel(modelId) {
        if (this.modelManager.removeModel(modelId)) {
            this.updateModelList();
        }
    }

    bindControls() {
        // 材质颜色控制
        document.getElementById('materialColor').addEventListener('change', (e) => {
            const color = parseInt(e.target.value.replace('#', ''), 16);
            this.modelManager.updateMaterialProperties({ color });
        });

        // 自发光强度控制
        document.getElementById('emissiveIntensity').addEventListener('input', (e) => {
            const intensity = parseFloat(e.target.value);
            this.modelManager.updateMaterialProperties({ emissiveIntensity: intensity });
        });

        // 透明度控制
        document.getElementById('opacity').addEventListener('input', (e) => {
            const opacity = parseFloat(e.target.value);
            this.modelManager.updateMaterialProperties({ opacity });
        });

        // 环境光强度控制
        document.getElementById('ambientIntensity').addEventListener('input', (e) => {
            const intensity = parseFloat(e.target.value);
            this.lightingManager.setAmbientIntensity(intensity);
        });

        // 方向光强度控制
        document.getElementById('directionalIntensity').addEventListener('input', (e) => {
            const intensity = parseFloat(e.target.value);
            this.lightingManager.setDirectionalIntensity(intensity);
        });
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        // 更新控制器
        this.cameraManager.update();

        // 渲染场景
        this.sceneManager.render(this.cameraManager.camera);
    }

    // 加载GLTF模型的公共方法
    async loadModel(path, position) {
        try {
            const model = await this.modelManager.loadGLTFModel(path, position);
            console.log('模型加载成功:', path);
            return model;
        } catch (error) {
            console.error('模型加载失败:', error);
        }
    }
}

// 应用启动
window.addEventListener('DOMContentLoaded', () => {
    window.app = new ThreeJSApp();

    // 示例：加载FBX模型（需要将模型文件放在models文件夹中）
    window.app.loadModel('http://localhost:8080/script/demo/output/Atlas_GPe1_L.glb', { x: 0, y: 0, z: 0 });
    window.app.loadModel('http://localhost:8080/script/demo/output/Atlas_GPe1_R.glb', { x: 0, y: 0, z: 0 });
});