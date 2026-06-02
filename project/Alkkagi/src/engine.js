/**
 * src/engine.js
 * Role: Core Engine initialization for Three.js and Rapier physics.
 * 
 * exported variable:
 * - scene & renderer: for scene management & render
 * - physicsWorld & eventQueue: for physics
 */

import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';

export let scene, renderer;
export let physicsWorld, eventQueue;
export let ambientLight, dirLight;

/** initialize Three.js & Rapier
 *  Three.js:
 *  - initialize scene, renderer, scene's composition, camera
 */
export async function initEngine() {
    await RAPIER.init();
    physicsWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    eventQueue = new RAPIER.EventQueue();

    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xffffff, 2.8);
    dirLight.position.set(20, 20, 0);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    dirLight.shadow.bias = -0.0004;
    dirLight.shadow.normalBias = 0.008;
    const shadowSize = 35;
    dirLight.shadow.camera.left = -shadowSize;
    dirLight.shadow.camera.right = shadowSize;
    dirLight.shadow.camera.top = shadowSize;
    dirLight.shadow.camera.bottom = -shadowSize;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    scene.add(dirLight);

    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// Syncs Three.js mesh transforms with physics bodies.
export function updateMeshPositions(objects) {
    objects.forEach((obj) => {
        if (obj.active) {
            const pos = obj.body.translation();
            const rot = obj.body.rotation();
            obj.mesh.position.set(pos.x, pos.y, pos.z);
            obj.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
        }
    });
}

export function setBrightness(level) {
    if (ambientLight && dirLight) {
        ambientLight.intensity = 0.6 * (level / 3);
        dirLight.intensity = 0.8 * (level / 3);
    }
}
