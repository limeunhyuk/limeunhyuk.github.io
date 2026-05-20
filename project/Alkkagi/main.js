import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import TWEEN from 'three/addons/libs/tween.module.js';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';

let scene, camera, renderer, controls;
let physicsWorld, eventQueue;
const objects = []; 

// State
let gameState = "MENU"; // MENU, AIMING, MOVING, ZOOMING_IN, MINIGAME, ZOOMING_OUT, GAMEOVER
let currentTurn = "black";
let firstCollisionOccurred = false;
let draggedStone = null;
let pointerDownPos = new THREE.Vector2();
let totalBlack = 10, totalWhite = 10;
let currentBlack = 10, currentWhite = 10;

// UI Elements
let rhythmUi, shrinkingRing, rhythmText;
let turnIndicator, blackScore, whiteScore;
let rhythmActive = false;
let ringSize = 250;

let uiContainer, statusContainer;
let startScreen, gameOverScreen, winnerText;
let inputBlack, inputWhite;

// Camera & Time Control
let currentCamPos = new THREE.Vector3(0, 40, 0);
let currentCamLook = new THREE.Vector3(0, 0, 0);
let targetCamPos = new THREE.Vector3(0, 40, 0);
let targetCamLook = new THREE.Vector3(0, 0, 0);
let currentSlowMoFactor = 1.0;

// Effects
let hitParticles = [];
let frameCount = 0;

// Drag Visuals
let dragLine = null; 
let trajectoryLine = null; 
let selectionRing = null; 

async function init() {
    await RAPIER.init();
    physicsWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    eventQueue = new RAPIER.EventQueue();

    initThree();
    createEnvironment();
    initInteraction();
    initUI();

    animate();
}

function initThree() {
    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 40, 0); 
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enabled = false; 

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    window.addEventListener('resize', onWindowResize, false);
}

function createEnvironment() {
    const textureLoader = new THREE.TextureLoader();
    const tatamiTex = textureLoader.load('assets/textures/tatami.png');
    tatamiTex.wrapS = THREE.RepeatWrapping;
    tatamiTex.wrapT = THREE.RepeatWrapping;
    tatamiTex.repeat.set(4, 4);

    const woodTex = textureLoader.load('assets/textures/wood.png');

    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({ map: tatamiTex, roughness: 0.8 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.5;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const boardSize = 15;
    const boardGeo = new THREE.BoxGeometry(boardSize, 0.5, boardSize);
    const boardMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.4 });
    const boardMesh = new THREE.Mesh(boardGeo, boardMat);
    boardMesh.position.y = -0.25;
    boardMesh.receiveShadow = true;
    boardMesh.castShadow = true;
    scene.add(boardMesh);

    const boardBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.25, 0);
    const boardBody = physicsWorld.createRigidBody(boardBodyDesc);
    const boardColliderDesc = RAPIER.ColliderDesc.cuboid(boardSize/2, 0.25, boardSize/2).setFriction(0.2).setRestitution(0.2);
    physicsWorld.createCollider(boardColliderDesc, boardBody);

    const gridHelper = new THREE.GridHelper(boardSize - 1, 18, 0x000000, 0x000000);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);
}

function clearStones() {
    objects.forEach(obj => {
        scene.remove(obj.mesh);
        physicsWorld.removeRigidBody(obj.body);
    });
    objects.length = 0;
}

function createStones(bCount, wCount) {
    clearStones();
    
    totalBlack = bCount;
    totalWhite = wCount;
    currentBlack = bCount;
    currentWhite = wCount;
    
    const positions = [];
    
    // 흑돌 배치 (지그재그)
    for(let i=0; i<bCount; i++) {
        const row = Math.floor(i / 5);
        const col = i % 5;
        const xOffset = row % 2 === 1 ? 1.0 : 0.0;
        positions.push({ x: -4 + col * 2.0 + xOffset, z: 6 - row, color: 'black' });
    }
    
    // 백돌 배치 (지그재그)
    for(let i=0; i<wCount; i++) {
        const row = Math.floor(i / 5);
        const col = i % 5;
        const xOffset = row % 2 === 1 ? 1.0 : 0.0;
        positions.push({ x: -4 + col * 2.0 + xOffset, z: -6 + row, color: 'white' });
    }

    const radius = 0.4;
    const height = 0.25;
    
    const stoneGeo = new THREE.SphereGeometry(radius, 32, 16);
    stoneGeo.scale(1, 0.5, 1); 

    // 실사풍(Physical) 돌 매테리얼 복구
    const blackMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.1, clearcoat: 0.5 });
    const whiteMat = new THREE.MeshPhysicalMaterial({ color: 0xeeeeee, roughness: 0.1, clearcoat: 0.5 });

    positions.forEach(pos => {
        const mesh = new THREE.Mesh(stoneGeo, pos.color === 'black' ? blackMat : whiteMat);
        mesh.position.set(pos.x, 0.125, pos.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(pos.x, 0.125, pos.z)
            .setLinearDamping(2.0) // 감쇠를 더 높여서 아주 무겁게
            .setAngularDamping(2.0);
            
        const body = physicsWorld.createRigidBody(bodyDesc);
        
        const colliderDesc = RAPIER.ColliderDesc.cylinder(height/2, radius)
            .setRestitution(0.9)
            .setFriction(0.3)
            .setDensity(1.0)
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
            
        physicsWorld.createCollider(colliderDesc, body);

        objects.push({ mesh, body, type: 'stone', color: pos.color, active: true });
    });
}

function initUI() {
    rhythmUi = document.getElementById('rhythm-container');
    shrinkingRing = document.getElementById('shrinking-ring');
    rhythmText = document.getElementById('rhythm-text');
    
    turnIndicator = document.getElementById('turn-indicator');
    blackScore = document.getElementById('black-score');
    whiteScore = document.getElementById('white-score');
    
    uiContainer = document.getElementById('ui-container');
    statusContainer = document.getElementById('status-container');
    startScreen = document.getElementById('start-screen');
    gameOverScreen = document.getElementById('game-over-screen');
    winnerText = document.getElementById('winner-text');
    
    inputBlack = document.getElementById('input-black');
    inputWhite = document.getElementById('input-white');

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && rhythmActive) {
            checkRhythmTiming();
        }
    });

    document.getElementById('btn-start').addEventListener('click', startGame);
    document.getElementById('btn-restart').addEventListener('click', () => {
        gameOverScreen.style.display = 'none';
        startGame();
    });
    document.getElementById('btn-to-start').addEventListener('click', () => {
        gameOverScreen.style.display = 'none';
        startScreen.style.display = 'flex';
        uiContainer.style.display = 'none';
        statusContainer.style.display = 'none';
        clearStones();
        gameState = "MENU";
    });
}

function startGame() {
    const bCount = parseInt(inputBlack.value) || 10;
    const wCount = parseInt(inputWhite.value) || 10;
    
    startScreen.style.display = 'none';
    uiContainer.style.display = 'block';
    statusContainer.style.display = 'block';
    
    createStones(bCount, wCount);
    currentTurn = "black";
    updateStatusUI();
    
    gameState = "AIMING";
    firstCollisionOccurred = false;
    
    currentCamPos.set(0, 40, 0);
    currentCamLook.set(0, 0, 0);
    camera.position.copy(currentCamPos);
    camera.lookAt(currentCamLook);
}

function gameOver(winner) {
    gameState = "GAMEOVER";
    winnerText.innerText = winner === 'black' ? "흑(Black) 승리! 🎉" : "백(White) 승리! 🎉";
    winnerText.style.color = winner === 'black' ? "#aaaaaa" : "#ffffff";
    
    setTimeout(() => {
        gameOverScreen.style.display = 'flex';
    }, 1000);
}

function updateStatusUI() {
    turnIndicator.innerText = `현재 차례: ${currentTurn === 'black' ? '흑(Black)' : '백(White)'}`;
    turnIndicator.style.color = currentTurn === 'black' ? '#aaaaaa' : '#ffffff';
    
    blackScore.innerText = `${currentBlack} / ${totalBlack}`;
    whiteScore.innerText = `${currentWhite} / ${totalWhite}`;
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function initInteraction() {
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const ringGeo = new THREE.RingGeometry(0.5, 0.6, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide });
    selectionRing = new THREE.Mesh(ringGeo, ringMat);
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.visible = false;
    scene.add(selectionRing);

    const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    dragLine = new THREE.Line(lineGeo, lineMat);
    dragLine.visible = false;
    scene.add(dragLine);

    const trajGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const trajMat = new THREE.LineDashedMaterial({ color: 0xffaa00, linewidth: 2, scale: 1, dashSize: 0.3, gapSize: 0.3 });
    trajectoryLine = new THREE.Line(trajGeo, trajMat);
    trajectoryLine.visible = false;
    scene.add(trajectoryLine);
}

function onPointerDown(e) {
    if (gameState !== "AIMING") return;
    
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects.filter(o => o.active).map(o => o.mesh));
    
    if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const clickedStone = objects.find(o => o.mesh === hitMesh);
        
        if (clickedStone.color !== currentTurn) return;

        draggedStone = clickedStone;
        raycaster.ray.intersectPlane(plane, pointerDownPos);
        
        selectionRing.position.set(draggedStone.mesh.position.x, 0.05, draggedStone.mesh.position.z);
        selectionRing.visible = true;
        dragLine.visible = true;
        trajectoryLine.visible = true;
    }
}

function onPointerMove(e) {
    if (!draggedStone || gameState !== "AIMING") return;
    
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);
    
    const startVec = new THREE.Vector3(draggedStone.mesh.position.x, 0.2, draggedStone.mesh.position.z);
    const dragVec = new THREE.Vector3().subVectors(startVec, intersectPoint);
    
    const maxDrag = 3.5;
    if (dragVec.length() > maxDrag) dragVec.setLength(maxDrag);
    
    const powerMultiplier = 0.75; // 돌 속도를 더 크게 줄임 (1.0 -> 0.75)
    const power = dragVec.length() * powerMultiplier;
    
    const lineEnd = startVec.clone().sub(dragVec);
    dragLine.geometry.setFromPoints([startVec, lineEnd]);
    
    if (dragVec.length() > 0.1) {
        const dir = dragVec.clone().normalize();
        
        const rayStart = new THREE.Vector3(startVec.x + dir.x * 0.45, 0.125, startVec.z + dir.z * 0.45);
        const ray = new RAPIER.Ray(
            { x: rayStart.x, y: rayStart.y, z: rayStart.z }, 
            { x: dir.x, y: 0, z: dir.z }
        );
        const hit = physicsWorld.castRay(ray, 20.0, true);
        
        const distance = hit ? hit.timeOfImpact + 0.45 : 20.0;
        const endVec = startVec.clone().add(dir.multiplyScalar(distance));
        endVec.y = 0.2;

        const dashFactor = Math.max(0.2, Math.min(1.0, power * 0.05));
        trajectoryLine.material.dashSize = dashFactor;
        trajectoryLine.material.gapSize = dashFactor;
        
        trajectoryLine.geometry.dispose(); 
        trajectoryLine.geometry = new THREE.BufferGeometry().setFromPoints([startVec, endVec]);
        trajectoryLine.computeLineDistances();
        trajectoryLine.visible = true;
    } else {
        trajectoryLine.visible = false;
    }
}

function onPointerUp(e) {
    if (!draggedStone || gameState !== "AIMING") return;
    
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);
    
    const startVec = new THREE.Vector3(draggedStone.mesh.position.x, 0, draggedStone.mesh.position.z);
    const dragVec = new THREE.Vector3().subVectors(startVec, intersectPoint);
    
    const maxDrag = 3.5;
    if (dragVec.length() > maxDrag) dragVec.setLength(maxDrag);

    const powerMultiplier = 0.75; // 돌 속도 대폭 감소
    const power = dragVec.length() * powerMultiplier;
    
    if (power > 0.5) {
        dragVec.normalize().multiplyScalar(power);
        draggedStone.body.applyImpulse({ x: dragVec.x, y: 0, z: dragVec.z }, true);
        
        gameState = "MOVING";
        firstCollisionOccurred = false;
        currentSlowMoFactor = 1.0;
        
        currentTurn = currentTurn === 'black' ? 'white' : 'black';
        updateStatusUI();
    }
    
    selectionRing.visible = false;
    dragLine.visible = false;
    trajectoryLine.visible = false;
    draggedStone = null;
}

function createBlockCharacter(color) {
    const group = new THREE.Group();
    const colorHex = color === 'black' ? 0x111111 : 0xeeeeee;
    const mat = new THREE.MeshPhysicalMaterial({ color: colorHex, roughness: 0.3, clearcoat: 0.5 });

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat);
    head.position.y = 0.9;
    head.castShadow = true;
    group.add(head);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.3), mat);
    body.position.y = 0.45;
    body.castShadow = true;
    group.add(body);

    const armGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
    armGeo.translate(0, -0.15, 0);
    
    const leftArm = new THREE.Mesh(armGeo, mat);
    leftArm.position.set(0.35, 0.6, 0);
    leftArm.castShadow = true;
    group.add(leftArm);
    group.leftArm = leftArm;

    const rightArm = new THREE.Mesh(armGeo, mat);
    rightArm.position.set(-0.35, 0.6, 0);
    rightArm.castShadow = true;
    group.add(rightArm);
    group.rightArm = rightArm;

    const legGeo = new THREE.BoxGeometry(0.18, 0.3, 0.18);
    legGeo.translate(0, -0.15, 0);
    
    const leftLeg = new THREE.Mesh(legGeo, mat);
    leftLeg.position.set(0.15, 0.2, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(legGeo, mat);
    rightLeg.position.set(-0.15, 0.2, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    group.scale.set(0.8, 0.8, 0.8);
    return group;
}

function startMiniGame(stone1, stone2) {
    if (gameState !== "MOVING") return;
    gameState = "ZOOMING_IN"; // 카메라가 완벽한 측면 앵글을 잡을 때까지 시간 확보
    
    const midPoint = new THREE.Vector3().addVectors(stone1.mesh.position, stone2.mesh.position).multiplyScalar(0.5);
    createHitEffect(midPoint);
    
    // 3D 캐릭터 변신 및 펀치 연출
    // 물리 엔진 충돌 직후이므로 현재 속도가 아닌 충돌 직전(prevLinvel) 속도를 기준으로 공격자를 판별
    const v1 = stone1.prevLinvel || stone1.body.linvel();
    const v2 = stone2.prevLinvel || stone2.body.linvel();
    const speed1 = v1.x*v1.x + v1.z*v1.z;
    const speed2 = v2.x*v2.x + v2.z*v2.z;
    
    const attackerStone = speed1 > speed2 ? stone1 : stone2;
    const defenderStone = speed1 > speed2 ? stone2 : stone1;

    stone1.mesh.visible = false;
    stone2.mesh.visible = false;

    const attacker = createBlockCharacter(attackerStone.color);
    attacker.position.set(attackerStone.mesh.position.x, 0.1, attackerStone.mesh.position.z);
    
    const defender = createBlockCharacter(defenderStone.color);
    defender.position.set(defenderStone.mesh.position.x, 0.1, defenderStone.mesh.position.z);

    attacker.lookAt(defender.position.x, attacker.position.y, defender.position.z);
    defender.lookAt(attacker.position.x, defender.position.y, attacker.position.z);

    scene.add(attacker);
    scene.add(defender);

    // 공격자의 무한 주먹질 애니메이션
    new TWEEN.Tween(attacker.rightArm.rotation)
        .to({ x: -Math.PI / 2 }, 150)
        .yoyo(true)
        .repeat(Infinity)
        .start();
        
    // 방어자 몸 흔들림
    new TWEEN.Tween(defender.rotation)
        .to({ x: defender.rotation.x - 0.2 }, 150)
        .yoyo(true)
        .repeat(Infinity)
        .start();

    window.currentFightScene = { attacker, defender, attackerStone, defenderStone };
    
    // 거리가 너무 가까웠을 경우를 대비하여 완벽한 측면 카메라 앵글을 강제로 TWEEN
    const dir = new THREE.Vector3().subVectors(attackerStone.mesh.position, defenderStone.mesh.position);
    if (dir.lengthSq() < 0.001) dir.set(1,0,0);
    dir.normalize();
    const sideVec = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    
    const targetCamPos = new THREE.Vector3().copy(midPoint).add(sideVec.multiplyScalar(7));
    targetCamPos.y = 2.5;

    new TWEEN.Tween(currentCamPos)
        .to(targetCamPos, 500)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();

    new TWEEN.Tween(currentCamLook)
        .to(midPoint, 500)
        .easing(TWEEN.Easing.Cubic.Out)
        .onComplete(() => {
            gameState = "MINIGAME";
            rhythmUi.style.display = 'block';
            rhythmActive = true;
            ringSize = 250;
            rhythmText.innerText = "타이밍에 맞춰 스페이스바!";
            rhythmText.style.color = "#fff";
        })
        .start();
}

function checkRhythmTiming() {
    rhythmActive = false;
    
    const diff = Math.abs(ringSize - 100);
    let rhythmResult = 'miss';
    
    if (diff <= 15) { // 85 ~ 115
        rhythmResult = 'perfect';
        rhythmText.innerText = "PERFECT!";
        rhythmText.style.color = "#00ff00";
    } else if (diff <= 35) { // 65 ~ 135
        rhythmResult = 'good';
        rhythmText.innerText = "GOOD!";
        rhythmText.style.color = "#ffff00";
    } else {
        rhythmResult = 'miss';
        rhythmText.innerText = "MISS... (페널티!)";
        rhythmText.style.color = "#ff0000";
    }

    if (window.currentFightScene) {
        window.currentFightScene.rhythmResult = rhythmResult;
    }

    setTimeout(() => {
        rhythmUi.style.display = 'none';
        gameState = "ZOOMING_OUT"; 
        
        new TWEEN.Tween(currentCamPos)
            .to({ x: 0, y: 40, z: 0 }, 1000)
            .easing(TWEEN.Easing.Cubic.InOut)
            .start();

        new TWEEN.Tween(currentCamLook)
            .to({ x: 0, y: 0, z: 0 }, 1000)
            .onComplete(() => {
                if (gameState === "ZOOMING_OUT") {
                    gameState = "MOVING"; 
                    currentSlowMoFactor = 1.0;
                    
                    // 캐릭터 제거 및 돌 원상복구 및 리듬게임 결과 물리엔진 적용
                    if (window.currentFightScene) {
                        scene.remove(window.currentFightScene.attacker);
                        scene.remove(window.currentFightScene.defender);
                        
                        const { attackerStone, defenderStone, rhythmResult } = window.currentFightScene;
                        attackerStone.mesh.visible = true;
                        defenderStone.mesh.visible = true;
                        
                        // 물리 엔진 결과 조작
                        const dir = new THREE.Vector3().subVectors(defenderStone.mesh.position, attackerStone.mesh.position);
                        dir.y = 0;
                        if (dir.lengthSq() < 0.001) dir.set(1, 0, 0);
                        dir.normalize();

                        if (rhythmResult === 'perfect') {
                            // Perfect: 공격자는 멈추고 방어자가 엄청난 속도로 날아감 (파워 대폭 상승)
                            attackerStone.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
                            const v = defenderStone.body.linvel();
                            const speed = Math.sqrt(v.x*v.x + v.z*v.z);
                            if (speed < 15.0) {
                                defenderStone.body.setLinvel({ x: dir.x * 15.0, y: 0, z: dir.z * 15.0 }, true);
                            }
                        } else if (rhythmResult === 'miss') {
                            // Miss: 방어자는 꿈쩍도 안 하고 공격자가 뒤로 튕겨져 나감 (페널티 파워 대폭 상승)
                            defenderStone.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
                            const v = attackerStone.body.linvel();
                            const speed = Math.sqrt(v.x*v.x + v.z*v.z);
                            const reboundSpeed = Math.max(15.0, speed);
                            attackerStone.body.setLinvel({ x: -dir.x * reboundSpeed, y: 0, z: -dir.z * reboundSpeed }, true);
                        }
                        // Good: 물리 엔진이 이미 계산한 자연스러운 튕김 그대로 둠

                        window.currentFightScene = null;
                    }
                }
            })
            .start();
            
    }, 1500);
}

function checkFallOffBoard() {
    if (gameState === "MENU" || gameState === "GAMEOVER") return;

    objects.forEach(obj => {
        if (obj.active) {
            const pos = obj.body.translation();
            if (pos.y < -1.0) {
                obj.active = false;
                obj.mesh.visible = false;
                
                obj.body.setTranslation({ x: 0, y: -100, z: 0 }, true);
                
                if (obj.color === 'black') currentBlack--;
                if (obj.color === 'white') currentWhite--;
                
                updateStatusUI();
            }
        }
    });

    if (currentBlack === 0 && currentWhite > 0) {
        gameOver("white");
    } else if (currentWhite === 0 && currentBlack > 0) {
        gameOver("black");
    } else if (currentBlack === 0 && currentWhite === 0) {
        gameOver("draw"); // Optional draw state
    }
}

function createHitEffect(position) {
    const particleCount = 40;
    const geometry = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const material = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

    for (let i = 0; i < particleCount; i++) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        
        // 구형으로 퍼져나가는 방향 벡터 계산
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        
        // 속도를 대폭 줄여 슬로우 모션 느낌 강화
        const speed = 0.01 + Math.random() * 0.02;
        
        const velocity = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        ).multiplyScalar(speed);

        scene.add(mesh);
        hitParticles.push({ mesh, velocity, life: 1.0 });
    }
    
    // 번쩍이는 플래시 조명
    const flash = new THREE.PointLight(0xff5500, 5, 10);
    flash.position.copy(position);
    scene.add(flash);
    
    new TWEEN.Tween(flash)
        .to({ intensity: 0 }, 1000)
        .onComplete(() => scene.remove(flash))
        .start();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(time) {
    requestAnimationFrame(animate);
    TWEEN.update(time);
    
    frameCount++;

    if (gameState === "MOVING" || gameState === "AIMING" || gameState === "GAMEOVER") {
        
        if (gameState === "MOVING") {
            let targetSlowMo = 1.0;
            targetCamPos.set(0, 40, 0);
            targetCamLook.set(0, 0, 0);

            if (!firstCollisionOccurred) {
                let minDistanceSq = 9999;
                let closestPair = null;

                // 1. 타겟 고정 (Lock-On) 시스템: 한 번 타겟을 잡으면 다른 돌로 시선이 휙휙 넘어가지 않게 방지
                if (window.lockedPair && window.lockedPair[0].active && window.lockedPair[1].active) {
                    const v1 = window.lockedPair[0].body.linvel();
                    const v2 = window.lockedPair[1].body.linvel();
                    const isMoving = (v1.x*v1.x + v1.z*v1.z > 0.5) || (v2.x*v2.x + v2.z*v2.z > 0.5);
                    const distSq = window.lockedPair[0].mesh.position.distanceToSquared(window.lockedPair[1].mesh.position);
                    
                    if (isMoving && distSq < 25.0) { // 한 번 락온되면 거리가 5.0(제곱 25) 이상 떨어질 때까지 유지
                        minDistanceSq = distSq;
                        closestPair = window.lockedPair;
                    } else {
                        window.lockedPair = null; // 멀어지면 락온 해제
                    }
                }

                // 락온된 페어가 없을 때만 새로 찾음
                if (!window.lockedPair) {
                    for (let i = 0; i < objects.length; i++) {
                        if (!objects[i].active) continue;
                        const v1 = objects[i].body.linvel();
                        const isMoving1 = (v1.x * v1.x + v1.z * v1.z) > 1.0;

                        for (let j = i + 1; j < objects.length; j++) {
                            if (!objects[j].active) continue;
                            const v2 = objects[j].body.linvel();
                            const isMoving2 = (v2.x * v2.x + v2.z * v2.z) > 1.0;

                            if (!isMoving1 && !isMoving2) continue;

                            const distSq = objects[i].mesh.position.distanceToSquared(objects[j].mesh.position);
                            if (distSq < minDistanceSq) {
                                minDistanceSq = distSq;
                                closestPair = [objects[i], objects[j]];
                            }
                        }
                    }
                    // 4.0(제곱 16) 이내로 들어오면 락온
                    if (minDistanceSq < 16.0 && closestPair) {
                        window.lockedPair = closestPair;
                    }
                }

                // 4.0 이내로 가까워지면 슬로우모션 및 줌인 시작
                if (minDistanceSq < 16.0 && closestPair) {
                    const dist = Math.sqrt(minDistanceSq);
                    
                    const v1 = closestPair[0].body.linvel();
                    const v2 = closestPair[1].body.linvel();
                    
                    const relativeVel = new THREE.Vector3(v1.x - v2.x, 0, v1.z - v2.z).length();
                    
                    const originalTime = (dist - 0.8) / Math.max(0.1, relativeVel);
                    const desiredTime = 1.2; 
                    
                    let optimalSlowMo = originalTime / desiredTime;
                    optimalSlowMo = Math.max(0.05, Math.min(1.0, optimalSlowMo));

                    let distFactor = (dist - 0.8) / (4.0 - 0.8);
                    distFactor = Math.max(0.0, Math.min(1.0, distFactor));

                    targetSlowMo = optimalSlowMo + (1.0 - optimalSlowMo) * distFactor;
                    
                    const midPoint = new THREE.Vector3().addVectors(closestPair[0].mesh.position, closestPair[1].mesh.position).multiplyScalar(0.5);
                    
                    // 2. 어지러움 방지: 카메라는 보드 중앙 쪽에 머물되, 시선만 돌을 따라가도록 안정화
                    targetCamLook.copy(midPoint); // 시선은 돌을 향함
                    
                    // 카메라는 돌을 너무 극단적으로 쫓아다니지 않고 중앙 기준 30% 정도만 이동 (고도 22로 살짝 하강)
                    const finalCamPos = new THREE.Vector3(midPoint.x * 0.3, 22, midPoint.z * 0.3 + 15);
                    const startCamPos = new THREE.Vector3(0, 40, 0);

                    const easeFactor = Math.pow(distFactor, 1.2); 
                    targetCamPos.lerpVectors(finalCamPos, startCamPos, easeFactor);
                } else {
                    window.lockedPair = null; // 거리 멀어지면 초기화
                }
            }

            currentSlowMoFactor += (targetSlowMo - currentSlowMoFactor) * 0.1;
            currentCamPos.lerp(targetCamPos, 0.05);
            currentCamLook.lerp(targetCamLook, 0.05);
        } else {
            currentSlowMoFactor = 1.0;
        }

        // 카메라 적용
        if (gameState !== "ZOOMING_OUT") {
            camera.position.copy(currentCamPos);
            camera.lookAt(currentCamLook);
        }

        // 충돌 직전의 속도를 기록 (충돌 후 공격자/방어자 판별을 위해)
        objects.forEach(obj => {
            if (obj.active) {
                obj.prevLinvel = { ...obj.body.linvel() };
            }
        });

        // 프레임 건너뛰기 대신 물리 엔진의 시간(dt) 자체를 변경하여 완벽하게 매끄러운 슬로우모션 구현
        physicsWorld.timestep = (1.0 / 60.0) * Math.max(0.01, currentSlowMoFactor);
        physicsWorld.step(eventQueue);

        if (gameState === "MOVING") {
            eventQueue.drainCollisionEvents((handle1, handle2, started) => {
                if (started) {
                    const obj1 = objects.find(o => o.body.handle === handle1);
                    const obj2 = objects.find(o => o.body.handle === handle2);
                    
                    if (obj1 && obj2 && obj1.type === 'stone' && obj2.type === 'stone') {
                        const midPoint = new THREE.Vector3().addVectors(obj1.mesh.position, obj2.mesh.position).multiplyScalar(0.5);
                        createHitEffect(midPoint);

                        if (!firstCollisionOccurred) {
                            firstCollisionOccurred = true;
                            startMiniGame(obj1, obj2);
                        }
                    }
                }
            });
        }
        
        updateMeshPositions();
        checkFallOffBoard();

        let movingCount = 0;
        objects.forEach((obj) => {
            if (obj.active) {
                const linVel = obj.body.linvel();
                const length = Math.sqrt(linVel.x*linVel.x + linVel.z*linVel.z);
                if (length > 0.1) movingCount++;
            }
        });

        if (gameState === "MOVING" && movingCount === 0) {
            gameState = "RETURN_TO_AIM";
            currentSlowMoFactor = 1.0;
            window.lockedPair = null;

            new TWEEN.Tween(currentCamPos)
                .to(new THREE.Vector3(0, 40, 0), 800)
                .easing(TWEEN.Easing.Cubic.Out)
                .start();

            new TWEEN.Tween(currentCamLook)
                .to(new THREE.Vector3(0, 0, 0), 800)
                .easing(TWEEN.Easing.Cubic.Out)
                .onComplete(() => {
                    gameState = "AIMING";
                })
                .start();
        }
    } else if (gameState === "ZOOMING_IN" || gameState === "ZOOMING_OUT" || gameState === "MINIGAME" || gameState === "RETURN_TO_AIM") {
        
        if (gameState === "ZOOMING_IN" || gameState === "RETURN_TO_AIM" || gameState === "ZOOMING_OUT") {
            camera.position.copy(currentCamPos);
            camera.lookAt(currentCamLook);
        } else if (gameState === "MINIGAME") {
            // 시간 정지 상태에서 매트릭스처럼 빙글빙글 도는 3D 카메라 워킹 연출
            if (window.currentFightScene) {
                const midPoint = new THREE.Vector3().addVectors(
                    window.currentFightScene.attackerStone.mesh.position, 
                    window.currentFightScene.defenderStone.mesh.position
                ).multiplyScalar(0.5);
                
                const radius = Math.sqrt(
                    Math.pow(currentCamPos.x - midPoint.x, 2) + 
                    Math.pow(currentCamPos.z - midPoint.z, 2)
                );
                
                // 아주 서서히 회전
                const currentAngle = Math.atan2(currentCamPos.z - midPoint.z, currentCamPos.x - midPoint.x);
                const newAngle = currentAngle + 0.005; 
                
                currentCamPos.x = midPoint.x + Math.cos(newAngle) * radius;
                currentCamPos.z = midPoint.z + Math.sin(newAngle) * radius;
                currentCamLook.copy(midPoint);
                
                camera.position.copy(currentCamPos);
                camera.lookAt(currentCamLook);
            }
        } else if (gameState === "ZOOMING_OUT") {
            camera.position.copy(currentCamPos);
            camera.lookAt(currentCamLook);
        }
    }

    // 파티클 업데이트 (항상 진행)
    for (let i = hitParticles.length - 1; i >= 0; i--) {
        const p = hitParticles[i];
        p.mesh.position.add(p.velocity);
        p.life -= 0.01;
        p.mesh.scale.setScalar(p.life);
        
        if (p.life <= 0) {
            scene.remove(p.mesh);
            hitParticles.splice(i, 1);
        }
    }

    if (rhythmActive) {
        ringSize -= 1.0; // 리듬게임 속도 대폭 감소 (기존 2.5 -> 1.0)
        if (ringSize < 40) { 
            checkRhythmTiming();
        } else {
            shrinkingRing.style.width = ringSize + 'px';
            shrinkingRing.style.height = ringSize + 'px';
        }
    }

    renderer.render(scene, camera);
}


function updateMeshPositions() {
    objects.forEach((obj) => {
        if (obj.active) {
            const pos = obj.body.translation();
            const rot = obj.body.rotation();
            obj.mesh.position.set(pos.x, pos.y, pos.z);
            obj.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
        }
    });
}

init().catch(e => console.error(e));
