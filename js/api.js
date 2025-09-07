class ThreeJSAPI {
    constructor(app) {
        this.app = app;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 监听外部消息
        window.addEventListener('message', this.handleMessage.bind(this));
        
        // 设置全局API
        window.ThreeJSAPI = {
            // 模型相关
            loadModelFromCDN: this.loadModelFromCDN.bind(this),
            setModelVisibility: this.setModelVisibility.bind(this),
            removeModel: this.removeModel.bind(this),
            getAllModels: this.getAllModels.bind(this),
            getLoadingStatus: this.getLoadingStatus.bind(this),
            
            // 摄像机相关
            setView: this.setView.bind(this),
            setCustomView: this.setCustomView.bind(this),
            getCameraState: this.getCameraState.bind(this),
            
            // 材质相关
            updateMaterialProperties: this.updateMaterialProperties.bind(this),
            
            // 光照相关
            setAmbientIntensity: this.setAmbientIntensity.bind(this),
            setDirectionalIntensity: this.setDirectionalIntensity.bind(this)
        };
    }

    handleMessage(event) {
        try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            
            if (data.type && data.type.startsWith('threejs_')) {
                this.processCommand(data);
            }
        } catch (error) {
            console.error('API消息处理错误:', error);
        }
    }

    async processCommand(command) {
        const { type, payload } = command;
        let result = { success: false, data: null, error: null };

        try {
            switch (type) {
                case 'threejs_load_model':
                    result.data = await this.loadModelFromCDN(
                        payload.cdnUrl, 
                        payload.modelId, 
                        payload.position
                    );
                    result.success = true;
                    break;

                case 'threejs_set_model_visibility':
                    result.success = this.setModelVisibility(
                        payload.modelId, 
                        payload.visible
                    );
                    break;

                case 'threejs_set_view':
                    result.success = this.setView(
                        payload.viewName, 
                        payload.duration
                    );
                    break;

                case 'threejs_get_models':
                    result.data = this.getAllModels();
                    result.success = true;
                    break;

                default:
                    result.error = `未知命令类型: ${type}`;
            }
        } catch (error) {
            result.error = error.message;
        }

        // 发送响应
        this.sendResponse(command.id, result);
    }

    sendResponse(commandId, result) {
        const response = {
            type: 'threejs_response',
            id: commandId,
            ...result
        };

        // 发送到父窗口（如果在iframe中）
        if (window.parent !== window) {
            window.parent.postMessage(JSON.stringify(response), '*');
        }

        // 触发自定义事件
        window.dispatchEvent(new CustomEvent('threejsResponse', {
            detail: response
        }));
    }

    // API方法实现
    async loadModelFromCDN(cdnUrl, modelId, position) {
        return await this.app.modelManager.downloadAndLoadModel(cdnUrl, modelId, position);
    }

    setModelVisibility(modelId, visible) {
        return this.app.modelManager.setModelVisibility(modelId, visible);
    }

    removeModel(modelId) {
        return this.app.modelManager.removeModel(modelId);
    }

    getAllModels() {
        return this.app.modelManager.getAllModels();
    }

    getLoadingStatus() {
        return this.app.modelManager.getLoadingStatus();
    }

    setView(viewName, duration = 1000) {
        return this.app.cameraManager.setView(viewName, duration);
    }

    setCustomView(position, target, duration = 1000) {
        this.app.cameraManager.setCustomView(position, target, duration);
    }

    getCameraState() {
        return this.app.cameraManager.getCameraState();
    }

    updateMaterialProperties(properties) {
        this.app.modelManager.updateMaterialProperties(properties);
    }

    setAmbientIntensity(intensity) {
        this.app.lightingManager.setAmbientIntensity(intensity);
    }

    setDirectionalIntensity(intensity) {
        this.app.lightingManager.setDirectionalIntensity(intensity);
    }
}