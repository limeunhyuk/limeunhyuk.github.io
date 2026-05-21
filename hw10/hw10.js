import * as THREE from 'three';  
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// Setup Scene, Camera, Renderer
const scene = new THREE.Scene();

let camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 120, 180);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000); // Black background
document.body.appendChild(renderer.domElement);

const stats = new Stats();
document.body.appendChild(stats.dom);

let orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 2.5); // Bright ambient light
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 5000, 500); // Bright sun light (Three.js r159 uses physically correct lighting, so higher intensity is needed)
pointLight.position.set(0, 0, 0); 
scene.add(pointLight);

// Texture Loader
const textureLoader = new THREE.TextureLoader();

// Planets configuration
const planetsData = [
    { name: 'Mercury', radius: 1.5, distance: 20, color: '#a6a6a6', rotationSpeed: 0.02, orbitSpeed: 0.02, texture: 'Mercury.jpg' },
    { name: 'Venus', radius: 3, distance: 35, color: '#e39e1c', rotationSpeed: 0.015, orbitSpeed: 0.015, texture: 'Venus.jpg' },
    { name: 'Earth', radius: 3.5, distance: 50, color: '#3498db', rotationSpeed: 0.01, orbitSpeed: 0.01, texture: 'Earth.jpg' },
    { name: 'Mars', radius: 2.5, distance: 65, color: '#c0392b', rotationSpeed: 0.008, orbitSpeed: 0.008, texture: 'Mars.jpg' }
];

// Sun
const sunGeometry = new THREE.SphereGeometry(10, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sun);

// Array to keep track of planets for animation
const planets = [];

planetsData.forEach(data => {
    // Orbit Group (centered at sun, handles orbital rotation)
    const orbitGroup = new THREE.Object3D();
    scene.add(orbitGroup);

    // Planet Mesh
    const geometry = new THREE.SphereGeometry(data.radius, 32, 32);
    // 조건의 color 값은 데이터로 유지하되, 텍스처 본연의 색상을 살리기 위해 재질 기본 색상을 흰색으로 적용
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textureLoader.load(`./${data.texture}`)
    });
    
    const planetMesh = new THREE.Mesh(geometry, material);
    planetMesh.position.x = data.distance;
    
    orbitGroup.add(planetMesh);

    planets.push({
        mesh: planetMesh,
        orbitGroup: orbitGroup,
        rotationSpeed: data.rotationSpeed,
        orbitSpeed: data.orbitSpeed,
        name: data.name
    });
});

// GUI Setup
const gui = new GUI({ title: 'Controls' });

// Camera Toggle
const cameraControls = {
    CameraType: 'Perspective',
    SwitchCamera: function () {
        if (camera instanceof THREE.PerspectiveCamera) {
            scene.remove(camera);
            
            const aspect = window.innerWidth / window.innerHeight;
            const frustumSize = 180;
            camera = new THREE.OrthographicCamera(
                (frustumSize * aspect) / -2, 
                (frustumSize * aspect) / 2, 
                frustumSize / 2, 
                frustumSize / -2, 
                0.1, 
                1000
            );
            camera.position.set(0, 120, 180);
            camera.lookAt(0, 0, 0);
            
            orbitControls.dispose();
            orbitControls = new OrbitControls(camera, renderer.domElement);
            orbitControls.enableDamping = true;
            this.CameraType = 'Orthogonal';
        } else {
            scene.remove(camera);
            camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(0, 120, 180);
            camera.lookAt(0, 0, 0);
            
            orbitControls.dispose();
            orbitControls = new OrbitControls(camera, renderer.domElement);
            orbitControls.enableDamping = true;
            this.CameraType = 'Perspective';
        }
    }
};

const cameraFolder = gui.addFolder('Camera');
cameraFolder.add(cameraControls, 'SwitchCamera').name('Switch Camera Type');
cameraFolder.add(cameraControls, 'CameraType').name('Current Camera').listen();

// Planet GUI Folders
planets.forEach(planet => {
    const folder = gui.addFolder(planet.name);
    folder.add(planet, 'rotationSpeed', 0, 0.1).name('Rotation Speed');
    folder.add(planet, 'orbitSpeed', 0, 0.1).name('Orbit Speed');
});

// Animation Loop
function animate() {
    requestAnimationFrame(animate);

    // Update planets rotation and orbit
    planets.forEach(planet => {
        planet.mesh.rotation.y += planet.rotationSpeed;
        planet.orbitGroup.rotation.y += planet.orbitSpeed;
    });

    orbitControls.update();
    stats.update();
    
    renderer.render(scene, camera);
}

// Handle Window Resize
window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    } else {
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = 180;
        camera.left = (frustumSize * aspect) / -2;
        camera.right = (frustumSize * aspect) / 2;
        camera.top = frustumSize / 2;
        camera.bottom = frustumSize / -2;
        camera.updateProjectionMatrix();
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
}

animate();
