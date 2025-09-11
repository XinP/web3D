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

    parseColor(txtContent) {
        const lines = txtContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const colorMap = {};

        const floatRe = /[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g;

        for (const line of lines) {
            const idx = line.indexOf(':');
            if (idx === -1) continue;
            const name = line.substring(0, idx).trim(); // e.g. "GPe1" 或 "STN2 motor"

            // 取冒号右侧的数字
            const rest = line.substring(idx + 1);
            const nums = rest.match(floatRe);
            if (!nums || nums.length < 3) continue;

            const r = Math.round(parseFloat(nums[0]) * 255);
            const g = Math.round(parseFloat(nums[1]) * 255);
            const b = Math.round(parseFloat(nums[2]) * 255);

            // 构造 0xRRGGBB（无符号）
            const hex = ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
            colorMap[name] = hex >>> 0;
        }
        return colorMap;
    }

    extractKeyFromFilename(filename) {
        const base = filename.split(/[/\\]/).pop();
        const match = base.match(/^Atlas_(.+?)(?:_[LR])?\.glb$/i);
        return match ? match[1] : null;
    }

    async downloadAndLoadModelsFromZip(url, position = { x: 0, y: 0, z: 0 }) {
        try {
            // 1. 下载 zip
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();

            // 2. 解压
            const zip = await JSZip.loadAsync(arrayBuffer);

            // 3. 找到 config.json
            let configFile = null;
            zip.forEach((relativePath, zipEntry) => {
                if (relativePath.toLowerCase().endsWith("config.json")) {
                    configFile = zipEntry;
                }
            });
            if (!configFile) throw new Error("zip中没有找到 config.json");

            // 4. 读取 JSON
            const configText = await configFile.async("string");
            const config = JSON.parse(configText);

            if (!config.folders || !Array.isArray(config.folders)) {
                throw new Error("config.json 格式不正确，应包含 folders 数组");
            }

            // 5. 遍历指定的文件夹，收集 glb 文件
            const glbEntries = [];
            zip.forEach((relativePath, zipEntry) => {
                if (relativePath.toLowerCase().endsWith(".glb")) {
                    for (const folder of config.folders) {
                        if (relativePath.startsWith(folder)) {
                            glbEntries.push({ path: relativePath, entry: zipEntry });
                            break;
                        }
                    }
                }
            });
            if (glbEntries.length === 0) {
                console.warn("未找到任何符合条件的 glb 文件");
                return [];
            }

            // 读取color txt 文件
            const txtContent = await zip.file("AtlasColor.txt").async("string");
            const colorMap = this.parseColor(txtContent);

            console.log(`colormap is ${JSON.stringify(colorMap)}`);


            // 7. 加载所有 glb
            const loadedModels = [];
            for (let i = 0; i < glbEntries.length; i++) {
                const { path, entry } = glbEntries[i];

                const glbBlob = await entry.async("blob");
                const objectUrl = URL.createObjectURL(glbBlob);
                console.log(`path is ${path}`);
                console.log(`entry is ${entry}`);

                const modelId = this.extractKeyFromFilename(path);
                console.log(`modelId is ${modelId}`);

                const color = colorMap[modelId] || 0x070707;
                const model = await this.loadGLTFFromBlob(objectUrl, modelId, color, position);

                URL.revokeObjectURL(objectUrl);

                loadedModels.push({ id: modelId, path, model });
            }

            console.log(`从ZIP加载完成，共 ${loadedModels.length} 个模型`);
            return loadedModels;

        } catch (error) {
            console.error("从ZIP加载模型失败:", error);
            throw error;
        }
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
                                transparent: true,
                                opacity: 0.9,
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
    loadGLTFFromBlob(blobUrl, modelId, color = 0xffffff, position = { x: 0, y: 0, z: 0 }) {
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
                            const lambertMaterial = new THREE.MeshStandardMaterial({
                                color: color,
                                emissive: 0x000000,
                                emissiveIntensity: 0,
                                transparent: true,
                                opacity: 0.9,
                                roughness: 0.7,
                                metalness: 0.0,
                                envMapIntensity: 1.5,
                                side: THREE.DoubleSide
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