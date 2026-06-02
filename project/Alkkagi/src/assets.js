/**
 * @file assets.js
 * @description
 * - 게임에 필요한 외부 3D 모델(.glb) 및 텍스처(이미지) 리소스를 미리 불러오고 전역에서 접근할 수 있도록 보관하는 저장소
 * - 로딩 실패 시 예외 처리(Fallback)를 적용하여 게임 실행이 중단되지 않도록 보장
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * @type {Object} assets
 * @description 로드 완료된 리소스들을 저장하는 전역 딕셔너리
 * @property {Object} models - 이름으로 접근 가능한 3D 모델(GLTF Scene) 모음
 * @property {Object} textures - 이름으로 접근 가능한 텍스처(Texture) 모음
 */
export const assets = {
    models: {},
    textures: {}
};

// 리소스 로더 인스턴스 초기화
const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();

/**
 * @function loadAssets
 * @description
 * - 지정된 경로의 모든 텍스처와 모델을 비동기적으로 불러옴 (Promise 기반)
 * - 로딩에 실패하더라도 경고 로그만 남기고 Promise를 resolve하여, 모델이 없는 경우 코드로 생성한 대체 도형(Fallback Mesh)을 사용할 수 있게 함
 * @returns {Promise<void>} 모든 리소스 로딩(또는 실패)이 완료되면 resolve되는 Promise
 */
export async function loadAssets() {
    // 불러올 텍스처 파일 경로 목록
    const texturePaths = {
        skybox: 'assets/textures/skybox.jpeg'
    };

    // 불러올 3D 모델 파일 경로 목록
    const modelPaths = {
        environment: 'assets/models/environment1.glb',
        stone: 'assets/models/stone.glb',
        character: 'assets/models/character.glb'
    };

    // 텍스처 로딩 Promise 배열 생성
    const texturePromises = Object.entries(texturePaths).map(([name, path]) => {
        return new Promise((resolve) => {
            textureLoader.load(path, (tex) => {
                assets.textures[name] = tex;
                resolve();
            }, undefined, (err) => {
                console.warn(`Failed to load texture: ${path}`, err);
                resolve(); // 에러 발생 시에도 진행을 막지 않음
            });
        });
    });

    // 모델 로딩 Promise 배열 생성
    const modelPromises = Object.entries(modelPaths).map(([name, path]) => {
        return new Promise((resolve) => {
            gltfLoader.load(path, (gltf) => {
                assets.models[name] = gltf.scene;
                resolve();
            }, undefined, (err) => {
                console.warn(`Failed to load model: ${path}`, err);
                resolve(); // 에러 발생 시에도 진행을 막지 않음 (각 모듈에서 자체 Fallback 처리)
            });
        });
    });

    // 모든 텍스처와 모델 로딩이 끝날 때까지 대기
    await Promise.all([...texturePromises, ...modelPromises]);
}
