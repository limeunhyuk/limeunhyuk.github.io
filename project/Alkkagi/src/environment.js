/**
 * src/environment.js
 * Role: Environment setup for the game board and ground.
 */
import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { scene, physicsWorld, renderer } from './engine.js';
import { assets } from './assets.js';


// initialize environment(floor & board)'s mesh and physics body
export function createEnvironment() {
    const boardSize = 15;

    if (assets.models.environment) {
        const env = assets.models.environment.clone();
        env.traverse((child) => {
            if (child.isMesh) {
                const isRoom = child.name.includes('Room');
                child.castShadow = !isRoom;
                child.receiveShadow = true;
                child.renderOrder = -1;
                if (child.material) {
                    child.material.depthWrite = true;
                }
            }
        });
        env.position.y -= 22.3;
        env.scale.setScalar(26);
        scene.add(env);
    }

    if (assets.textures.skybox) {
        const skyTexture = assets.textures.skybox;
        const renderTarget = new THREE.WebGLCubeRenderTarget(skyTexture.image.height);
        renderTarget.fromEquirectangularTexture(renderer, skyTexture);
        scene.background = renderTarget.texture;
    }

    // Physics Board Collider (Always needed for the stones to rest on)
    const boardBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.25, 0);
    const boardBody = physicsWorld.createRigidBody(boardBodyDesc);
    const boardColliderDesc = RAPIER.ColliderDesc.cuboid(boardSize/2, 0.25, boardSize/2)
        .setFriction(0.2)
        .setRestitution(0.2);
    physicsWorld.createCollider(boardColliderDesc, boardBody);
}
