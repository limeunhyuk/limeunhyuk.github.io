/**
 * src/engine.js
 * Role: Core Engine initialization for Three.js and Rapier physics.
 * Functions:
 * - initEngine(): Initializes Three.js (scene, camera, renderer, lights) and Rapier physics.
 * - updateMeshPositions(objects): Syncs Three.js mesh transforms with physics bodies.
 */
import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';

export let scene, renderer;
export let physicsWorld, eventQueue;

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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}


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
