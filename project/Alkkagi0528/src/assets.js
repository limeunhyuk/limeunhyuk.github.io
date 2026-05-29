/**
 * src/assets.js
 * Role: Asset Loader for models and textures.
 * Functions:
 * - loadAssets(): Preloads .glb models and textures.
 * - assets: Object storing the loaded resources.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const assets = {
    models: {},
    textures: {}
};

const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();

// Preloads .glb models and textures.
export async function loadAssets() {
    const texturePaths = {
        tatami: 'assets/textures/tatami.png',
        wood: 'assets/textures/wood.png'
    };

    const modelPaths = {
        environment: 'assets/models/environment.glb',
        stone: 'assets/models/stone.glb',
        character: 'assets/models/character.glb'
    };

    const texturePromises = Object.entries(texturePaths).map(([name, path]) => {
        return new Promise((resolve) => {
            textureLoader.load(path, (tex) => {
                assets.textures[name] = tex;
                resolve();
            }, undefined, (err) => {
                console.warn(`Failed to load texture: ${path}`, err);
                resolve(); // Continue even if texture fails
            });
        });
    });

    const modelPromises = Object.entries(modelPaths).map(([name, path]) => {
        return new Promise((resolve) => {
            gltfLoader.load(path, (gltf) => {
                assets.models[name] = gltf.scene;
                resolve();
            }, undefined, (err) => {
                console.warn(`Failed to load model: ${path}`, err);
                // We'll handle missing models by providing fallback meshes in respective modules
                resolve(); 
            });
        });
    });

    await Promise.all([...texturePromises, ...modelPromises]);
}
