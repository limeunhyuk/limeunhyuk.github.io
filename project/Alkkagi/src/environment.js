/**
 * @file environment.js
 * @description
 * - 게임의 배경(방, 책상, 바둑판 등) 모델링 및 스카이박스를 생성 및 배치
 * - 바둑판을 위한 정적 물리 바디(RigidBody)를 생성하여 돌들이 떨어지지 않고 굴러다닐 수 있는 지면 역할 수행
 * - 그림자 및 투명도 렌더링 우선순위(renderOrder) 등의 최적화 설정 적용
 */

import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { scene, physicsWorld, renderer } from './engine.js';
import { assets } from './assets.js';

/**
 * @function createEnvironment
 * @description
 * - 에셋으로 로드된 3D 환경 모델(GLTF)을 씬에 복제하여 추가
 * - 거대한 배경 방(Room) 모델이 그림자 연산에 영향을 주어 까매지는 현상을 막기 위한 그림자 옵션 세팅
 * - 파티클(날씨 등) 투명도 정렬 버그를 방지하기 위해 renderOrder를 -1로 강제 설정
 * - 360도 스카이박스 배경 적용
 * - 바둑판(크기 15x15) 면적에 맞는 마찰력과 반발력을 가진 보이지 않는 물리 바디 생성
 */
export function createEnvironment() {
    const boardSize = 15;

    // 1. 외부 에셋(방, 책상 등) 렌더링 세팅
    if (assets.models.environment) {
        const env = assets.models.environment.clone();
        env.traverse((child) => {
            if (child.isMesh) {
                const isRoom = child.name.includes('Room');
                
                // Room(거대한 외벽)은 그림자 캐스팅을 막아 성능 최적화 및 거대 그림자 방지
                child.castShadow = !isRoom;
                // 바닥을 포함한 모든 물체가 그림자를 받을 수 있도록 설정
                child.receiveShadow = true;
                
                // 투명한 날씨 입자가 배경 뒤에 렌더링되어 사라지는 버그 방지 (배경을 먼저 그림)
                child.renderOrder = -1;
                
                if (child.material) {
                    // 깊이 버퍼 쓰기 활성화 (그림자와 형태 구분을 위함)
                    child.material.depthWrite = true;
                }
            }
        });
        
        // 모델의 원점 위치와 스케일 보정
        env.position.y -= 22.3;
        env.scale.setScalar(26);
        scene.add(env);
    }

    // 2. 스카이박스(하늘 배경) 텍스처 적용
    if (assets.textures.skybox) {
        const skyTexture = assets.textures.skybox;
        const renderTarget = new THREE.WebGLCubeRenderTarget(skyTexture.image.height);
        renderTarget.fromEquirectangularTexture(renderer, skyTexture);
        scene.background = renderTarget.texture;
    }

    // 3. 바둑판 물리 콜라이더 생성 (돌들이 안착할 물리적 지면)
    // 약간 아래(-0.25)에 배치하여 3D 모델과 물리적 표면을 일치시킴
    const boardBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.25, 0);
    const boardBody = physicsWorld.createRigidBody(boardBodyDesc);
    
    // 마찰력(Friction)과 탄성(Restitution)을 낮게 설정하여 바둑돌이 자연스럽게 미끄러지도록 함
    const boardColliderDesc = RAPIER.ColliderDesc.cuboid(boardSize/2, 0.25, boardSize/2)
        .setFriction(0.2)
        .setRestitution(0.2);
    physicsWorld.createCollider(boardColliderDesc, boardBody);
}
