/**
 * src/environment.js
 * Role: Environment setup for the game board and ground.
 */
import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { scene, physicsWorld } from './engine.js';
import { assets } from './assets.js';


// initialize environment(floor & board)'s mesh and physics body
export function createEnvironment() {
    const boardSize = 15;

    if (assets.models.environment) {
        const env = assets.models.environment.clone();
        scene.add(env);
    } else {
        // Fallback to original procedural code
        const tatamiTex = assets.textures.tatami;
        if (tatamiTex) {
            tatamiTex.wrapS = THREE.RepeatWrapping;
            tatamiTex.wrapT = THREE.RepeatWrapping;
            tatamiTex.repeat.set(4, 4);
        }

        const woodTex = assets.textures.wood;

        const groundGeo = new THREE.PlaneGeometry(100, 100);
        const groundMat = new THREE.MeshStandardMaterial({ 
            map: tatamiTex, 
            color: tatamiTex ? 0xffffff : 0x445533,
            roughness: 0.8 
        });
        const groundMesh = new THREE.Mesh(groundGeo, groundMat);
        groundMesh.rotation.x = -Math.PI / 2;
        groundMesh.position.y = -0.5;
        groundMesh.receiveShadow = true;
        scene.add(groundMesh);

        const boardGeo = new THREE.BoxGeometry(boardSize, 0.5, boardSize);
        const boardMat = new THREE.MeshStandardMaterial({ 
            map: woodTex, 
            color: woodTex ? 0xffffff : 0x886644,
            roughness: 0.4 
        });
        const boardMesh = new THREE.Mesh(boardGeo, boardMat);
        boardMesh.position.y = -0.25;
        boardMesh.receiveShadow = true;
        boardMesh.castShadow = true;
        scene.add(boardMesh);

        const gridHelper = new THREE.GridHelper(boardSize - 1, 18, 0x000000, 0x000000);
        gridHelper.position.y = 0.01;
        scene.add(gridHelper);
    }

    // Physics Board Collider (Always needed for the stones to rest on)
    const boardBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.25, 0);
    const boardBody = physicsWorld.createRigidBody(boardBodyDesc);
    const boardColliderDesc = RAPIER.ColliderDesc.cuboid(boardSize/2, 0.25, boardSize/2)
        .setFriction(0.2)
        .setRestitution(0.2);
    physicsWorld.createCollider(boardColliderDesc, boardBody);
}
