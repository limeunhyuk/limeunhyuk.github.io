import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { ShockwaveShader } from './shockWaveShader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x222222 );

function initRenderer(additionalProperties) {

    const props = (typeof additionalProperties !== 'undefined' && additionalProperties) ? additionalProperties : {};
    const renderer = new THREE.WebGLRenderer(props);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.setClearColor(new THREE.Color(0x222222));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    return renderer;
}

const renderer = initRenderer();

// initCamera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100000);
camera.lookAt(new THREE.Vector3(0, 0, 0));
camera.position.set( 65, 60, 120 );
scene.add(camera);

const wallShaderVert = await loadShaderFile('./wallShader/shVert.glsl');
const wallShaderFrag = await loadShaderFile('./wallShader/shFrag.glsl');

async function loadShaderFile(fileNameDir) {
    const response = await fetch(`${fileNameDir}`);
    return await response.text();
}

// function initScene() {
    const dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
    dirLight.position.set( -500, 500, 500 );
    // dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 2000;
    dirLight.shadow.camera.left = -500;
    dirLight.shadow.camera.right = 500;
    dirLight.shadow.camera.top = 500;
    dirLight.shadow.camera.bottom = -500;
    scene.add( dirLight );

    // Directional Light Helper
    const dirLightHelper = new THREE.DirectionalLightHelper( dirLight, 5 );
    dirLightHelper.visible = true; 
    // scene.add( dirLightHelper );

    // Directional Light Shadow Camera Helper
    const dirLightShadowCameraHelper = new THREE.CameraHelper( dirLight.shadow.camera );
    dirLightShadowCameraHelper.visible = true; 
    // scene.add( dirLightShadowCameraHelper );

    // ground
    const groundMesh = new THREE.Mesh( new THREE.PlaneGeometry( 300, 300 ), 
                                new THREE.MeshPhongMaterial( 
                                    { color: 0x888888, depthWrite: false } ) );
    groundMesh.rotation.x = -0.5 * Math.PI;
    groundMesh.receiveShadow = true;
    scene.add( groundMesh );


    const gridHelper = new THREE.GridHelper( 300, 20, 0x000000, 0x000000 );
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add( gridHelper );

    // axisHelper
    const axesHelper = new THREE.AxesHelper(300); 
    scene.add(axesHelper);

    const wallWidth = 100;
    const wallHeight = 30;
    const wallShaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: {value: 0.0},
            uHitPosition: {value: new THREE.Vector2(0.0, 0.0)},
            uHitTime: {value: -1000.0},
            uWaveSpeed: {value: 1.0},
            uWaveWidth: {value: 1.0},
            uMeshRatio: {value: wallHeight / wallWidth},
            uEdgeGlowWidth: {value: 0.02}
        },
        vertexShader: wallShaderVert,
        fragmentShader: wallShaderFrag,
        side: THREE.DoubleSide,
        transparent: true
    });
    const wallGeometry = new THREE.PlaneGeometry(wallWidth, wallHeight);
    const wallMesh = new THREE.Mesh(wallGeometry, wallShaderMaterial);
    scene.add( wallMesh );
    wallMesh.position.y += 20;
// }

// wave shader setting
wallMesh.material.uniforms.uWaveSpeed.value = 0.5;
wallMesh.material.uniforms.uWaveWidth.value = 0.01;
// window.addEventListener('keydown', (e) => {
//     if(e.key == ' ') {
//         wallMesh.material.uniforms.uHitPosition.value = new THREE.Vector2(0.5, 0.5);
//         wallMesh.material.uniforms.uHitTime.value = lastTime;
//     }
// });

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
window.addEventListener('mousedown', (e) => {
    // 2. 브라우저의 마우스 클릭 좌표를 Three.js 정규화 좌표(-1.0 ~ 1.0)로 변환합니다.
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    // 3. 카메라와 마우스 위치를 기준으로 레이(광선)를 쏩니다.
    raycaster.setFromCamera(mouse, camera);

    // 4. 타겟이 되는 wallMesh와의 충돌 여부를 검사합니다.
    const intersects = raycaster.intersectObject(wallMesh);

    // 5. 충돌한 물체가 있다면 내부 로직을 실행합니다.
    if (intersects.length > 0) {
        // 첫 번째 충돌 지점의 상세 데이터(hit 정보)를 가져옵니다.
        const hit = intersects[0];

        // 6. 메쉬의 기하학적 구조(Geometry)에 UV 정보가 매핑되어 있는지 확인합니다.
        if (hit.uv) {
            // 충돌한 지점의 정확한 uv 좌표(Vector2)를 셰이더 변수에 대입합니다.
            wallMesh.material.uniforms.uHitPosition.value.copy(hit.uv);
            
            // 기존 uHitTime 로직은 그대로 유지합니다.
            wallMesh.material.uniforms.uHitTime.value = lastTime;
        }
    }
});

// initOrbitControl
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.rotateSpeed = 1.0;
orbitControls.zoomSpeed = 1.2;
orbitControls.panSpeed = 0.8;
orbitControls.noZoom = false;
orbitControls.noPan = false;
orbitControls.staticMoving = true;
orbitControls.dynamicDampingFactor = 0.3;
orbitControls.keys = [65, 83, 68];
orbitControls.target.set(0, 0, 0); 
orbitControls.update();

// onWindowResize
window.addEventListener( 'resize', onWindowResize, false );

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
}


const shockwavePass = new ShaderPass( ShockwaveShader );

// EffectComposer
const composer = new EffectComposer( renderer );
// adding some passes
const renderPass = new RenderPass( scene, camera );
composer.addPass( renderPass );
const resolution = new THREE.Vector2( window.innerWidth, window.innerHeight );
const bloomPass = new UnrealBloomPass(resolution, .25, .5, .2);
composer.addPass( bloomPass );
// 충격파 속성 설정 (속도, 번짐, 강도)
shockwavePass.uniforms.uParameters.value.set(.3, 0.06, 0.01);
composer.addPass( shockwavePass );
const outputPass = new OutputPass();
composer.addPass( outputPass );


let lastTime;

function animate(time) {
    requestAnimationFrame( animate );
    let delta = time - lastTime;
    // startTime 부터 경과된 시간
    
    wallMesh.material.uniforms.uTime.value = time;
    shockwavePass.uniforms.uTime.value = time / 1000;

    composer.render( scene, camera );
    orbitControls.update();
    lastTime = time;
}

const startTime = Date.now(); 
animate();