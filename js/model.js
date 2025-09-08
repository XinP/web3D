class ModelManager {
    constructor(scene) {
        this.scene = scene;
        this.models = [];
        this.materials = new Map();
        this.modelMap = new Map(); // 新增：模型映射管理
        this.loader = new THREE.GLTFLoader();
        this.loadingQueue = []; // 新增：下载队列
        this.init();
    }

    init() {
        // 创建默认几何体作为示例（当没有GLTF文件时）
        //this.createDefaultModel();
    }

    createDefaultModel() {
        // 创建一个立方体作为示例
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            emissive: 0x000000,
            emissiveIntensity: 0,
            transparent: false,
            opacity: 1.0,
            side: THREE.DoubleSide
        });

        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(0, 1, 0);
        cube.castShadow = true;
        cube.receiveShadow = true;

        this.scene.add(cube);
        this.models.push(cube);
        this.materials.set('default', material);

        // 添加地面
        const planeGeometry = new THREE.PlaneGeometry(20, 20);
        const planeMaterial = new THREE.MeshLambertMaterial({
            color: 0x808080,
            transparent: false,
            opacity: 1.0
        });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -1;
        plane.receiveShadow = true;

        this.scene.add(plane);
        this.models.push(plane);
    }

    loadGLTFModel(path, position = { x: 0, y: 0, z: 0 }, scale = 0.5) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                path,
                (gltf) => {
                    const object = gltf.scene;

                    // 设置位置
                    object.position.set(position.x, position.y, position.z);
                    object.scale.set(scale, scale, scale);
                    // 遍历模型的所有子对象，应用Lambert材质
                    object.traverse((child) => {
                        if (child.isMesh) {
                            console.log('object is mesh, set material LambertMaterial');

                            //child.geometry.computeVertexNormals();
                            // 创建Lambert材质
                            const material = new THREE.MeshStandardMaterial({
                                color: 0xffffff,
                                emissive: 0x000000,
                                emissiveIntensity: 0,
                                transparent: false,
                                opacity: 1.0,
                                roughness: 0.7,
                                metalness: 0.0,
                                side: THREE.DoubleSide,
                            });

                            child.material = material;
                            child.castShadow = true;
                            child.receiveShadow = true;

                            this.materials.set(child.uuid, material);
                        }
                    });

                    this.scene.add(object);
                    this.models.push(object);

                    resolve(object);
                },
                (progress) => {
                    console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error('Error loading GLTF model:', error);
                    reject(error);
                }
            );
        });
    }

    updateMaterialProperties(properties) {
        this.materials.forEach((material) => {
            if (properties.color !== undefined) {
                material.color.setHex(properties.color);
            }
            if (properties.emissiveIntensity !== undefined) {
                material.emissiveIntensity = properties.emissiveIntensity;
            }
            if (properties.opacity !== undefined) {
                material.opacity = properties.opacity;
                material.transparent = properties.opacity < 1.0;
            }
        });
    }

    // 新增：从CDN下载并加载模型
    async downloadAndLoadModel(cdnUrl, modelId, position = { x: 0, y: 0, z: 0 }) {
        try {
            // 添加到下载队列
            this.loadingQueue.push({ url: cdnUrl, id: modelId, status: 'downloading' });

            // 创建临时URL用于下载
            const response = await fetch(cdnUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);

            // 更新队列状态
            const queueItem = this.loadingQueue.find(item => item.id === modelId);
            if (queueItem) queueItem.status = 'loading';

            // 加载模型
            const model = await this.loadGLTFFromBlob(objectUrl, modelId, position);

            // 清理临时URL
            URL.revokeObjectURL(objectUrl);

            // 更新队列状态
            if (queueItem) queueItem.status = 'completed';

            console.log(`模型 ${modelId} 从CDN加载成功:`, cdnUrl);
            return model;

        } catch (error) {
            console.error(`模型 ${modelId} 加载失败:`, error);
            const queueItem = this.loadingQueue.find(item => item.id === modelId);
            if (queueItem) queueItem.status = 'error';
            throw error;
        }
    }

    // 新增：从Blob加载GLTF模型
    loadGLTFFromBlob(blobUrl, modelId, position = { x: 0, y: 0, z: 0 }) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                blobUrl,
                (gltf) => {
                    const object = gltf.scene;
                    object.position.set(position.x, position.y, position.z);

                    // 设置模型ID
                    object.userData.modelId = modelId;

                    // 遍历并设置材质
                    object.traverse((child) => {
                        if (child.isMesh) {
                            const lambertMaterial = new THREE.MeshLambertMaterial({
                                color: 0xffffff,
                                emissive: 0x000000,
                                emissiveIntensity: 0,
                                transparent: false,
                                opacity: 1.0
                            });

                            child.material = lambertMaterial;
                            child.castShadow = true;
                            child.receiveShadow = true;
                            this.materials.set(child.uuid, lambertMaterial);
                        }
                    });

                    this.scene.add(object);
                    this.models.push(object);
                    this.modelMap.set(modelId, object);

                    resolve(object);
                },
                (progress) => {
                    console.log(`Loading ${modelId}:`, (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error(`Error loading GLTF model ${modelId}:`, error);
                    reject(error);
                }
            );
        });
    }

    // 新增：显示/隐藏模型
    setModelVisibility(modelId, visible) {
        const model = this.modelMap.get(modelId);
        if (model) {
            model.visible = visible;
            return true;
        }
        console.warn(`模型 ${modelId} 未找到`);
        return false;
    }

    // 新增：获取模型
    getModel(modelId) {
        return this.modelMap.get(modelId);
    }

    // 新增：获取所有模型列表
    getAllModels() {
        return Array.from(this.modelMap.entries()).map(([id, model]) => ({
            id,
            name: model.name,
            visible: model.visible,
            position: model.position.clone()
        }));
    }

    // 新增：移除模型
    removeModel(modelId) {
        const model = this.modelMap.get(modelId);
        if (model) {
            this.scene.remove(model);
            this.modelMap.delete(modelId);

            // 从models数组中移除
            const index = this.models.indexOf(model);
            if (index > -1) {
                this.models.splice(index, 1);
            }

            // 清理材质
            model.traverse((child) => {
                if (child.isMesh && child.material) {
                    this.materials.delete(child.uuid);
                    child.material.dispose();
                }
            });

            return true;
        }
        return false;
    }

    // 新增：获取下载队列状态
    getLoadingStatus() {
        return this.loadingQueue.map(item => ({
            id: item.id,
            url: item.url,
            status: item.status
        }));
    }
}