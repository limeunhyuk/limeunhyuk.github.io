/*-------------------------------------------------------------------------
Homework 06: Dual Viewports (Perspective & Orthographic)

- Left viewport: First-Person Camera with Perspective projection
   1) w, a, s, d keys: move the camera forward, left, backward, and right
   2) mouse horizontal movement: rotate the camera around the y-axis (yaw)
   3) mouse vertical movement: rotate the camera around the x-axis (pitch)
   4) Pointer lock: Click canvas to lock, ESC to unlock
- Right viewport: Top-Down Orthographic projection (Fixed Camera)
- Renders 5 cubes at specific locations with independent background colors
  using gl.viewport() and gl.scissor().
---------------------------------------------------------------------------*/
import { resizeAspectRatio, setupText, Axes, updateText } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';
import { Cube } from '../util/cube.js';

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');

let shader;
let startTime;
let lastFrameTime;
let isInitialized = false;
let text1;

// Viewport configuration array for left (Perspective) and right (Orthographic) views
const viewports = [
    {
        x: 0,
        y: 0,
        width: 700,
        height: 700,
        color: [0.1, 0.2, 0.3, 1.0], // Left background color
        viewMatrix: mat4.create(),
        projMatrix: mat4.create()
    },
    {
        x: 700,
        y: 0,
        width: 700,
        height: 700,
        color: [0.05, 0.15, 0.2, 1.0], // Right background color
        viewMatrix: mat4.create(),
        projMatrix: mat4.create()
    }
];

let modelMatrixes = []; // Array to store model matrices for the 5 cubes
const cube = new Cube(gl);
const axes = new Axes(gl, 2.0);

// Global variables for the First-Person Camera (Left Viewport)
let cameraPos = vec3.fromValues(0, 0, 5);
let cameraFront = vec3.fromValues(0, 0, -1);
let cameraUp = vec3.fromValues(0, 1, 0);
let yaw = -90;
let pitch = 0;
const mouseSensitivity = 0.1;
const cameraSpeed = 2.5;

// Global variables for keyboard input state
const keys = {
    'w': false,
    'a': false,
    's': false,
    'd': false
};

// Initialize the program when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) {
        console.log("Already initialized");
        return;
    }

    main().then(success => {
        if (!success) {
            console.log('program terminated');
            return;
        }
        isInitialized = true;
    }).catch(error => {
        console.error('program terminated with error:', error);
    });
});

// Keyboard event listeners
document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key in keys) {
        keys[key] = true;
    }
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key in keys) {
        keys[key] = false;
    }
});

// Mouse event listener for pointer lock (First-Person Camera)
canvas.addEventListener('click', () => {
    canvas.requestPointerLock();
    console.log("Canvas clicked, requesting pointer lock");
});

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) {
        console.log("Pointer is locked");
        document.addEventListener("mousemove", updateCamera);
    } else {
        console.log("Pointer is unlocked");
        document.removeEventListener("mousemove", updateCamera);
    }
});

// Update camera direction based on mouse movement
function updateCamera(e) {
    const xoffset = e.movementX * mouseSensitivity;
    const yoffset = -e.movementY * mouseSensitivity;

    yaw += xoffset;
    pitch += yoffset;

    // Pitch limit to prevent screen flip
    if (pitch > 89.0) pitch = 89.0;
    if (pitch < -89.0) pitch = -89.0;

    // Calculate new camera front vector using spherical coordinates
    const direction = vec3.create();
    direction[0] = Math.cos(glMatrix.toRadian(yaw)) * Math.cos(glMatrix.toRadian(pitch));
    direction[1] = Math.sin(glMatrix.toRadian(pitch));
    direction[2] = Math.sin(glMatrix.toRadian(yaw)) * Math.cos(glMatrix.toRadian(pitch));
    vec3.normalize(cameraFront, direction);
}

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }

    canvas.width = 1400;
    canvas.height = 700;
    resizeAspectRatio(gl, canvas);

    // Enable scissor test for independent viewport clearing
    gl.enable(gl.SCISSOR_TEST);

    return true;
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

function render() {
    const currentTime = Date.now();
    const deltaTime = (currentTime - lastFrameTime) / 1000.0;
    lastFrameTime = currentTime;

    // Camera movement based on keyboard input
    const cameraSpeedWithDelta = cameraSpeed * deltaTime;

    if (keys['w']) {
        vec3.scaleAndAdd(cameraPos, cameraPos, cameraFront, cameraSpeedWithDelta);
    }
    if (keys['s']) {
        vec3.scaleAndAdd(cameraPos, cameraPos, cameraFront, -cameraSpeedWithDelta);
    }
    if (keys['a']) {
        const cameraRight = vec3.create();
        vec3.cross(cameraRight, cameraFront, cameraUp);
        vec3.normalize(cameraRight, cameraRight);
        vec3.scaleAndAdd(cameraPos, cameraPos, cameraRight, -cameraSpeedWithDelta);
    }
    if (keys['d']) {
        const cameraRight = vec3.create();
        vec3.cross(cameraRight, cameraFront, cameraUp);
        vec3.normalize(cameraRight, cameraRight);
        vec3.scaleAndAdd(cameraPos, cameraPos, cameraRight, cameraSpeedWithDelta);
    }

    // Update the view matrix for the left viewport (First-Person Camera)
    mat4.lookAt(viewports[0].viewMatrix,
        cameraPos,
        vec3.add(vec3.create(), cameraPos, cameraFront),
        cameraUp);

    // Render loop for each viewport
    viewports.forEach(v => {
        gl.viewport(v.x, v.y, v.width, v.height);
        gl.scissor(v.x, v.y, v.width, v.height);

        // Clear background with independent colors
        gl.clearColor(v.color[0], v.color[1], v.color[2], v.color[3]);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);

        // Draw the 5 cubes
        shader.use();
        for(let i = 0; i < modelMatrixes.length; i++) {
            shader.setMat4('u_model', modelMatrixes[i]);
            shader.setMat4('u_view', v.viewMatrix);
            shader.setMat4('u_projection', v.projMatrix);
            cube.draw(shader);
        }

        // Draw the axes
        axes.draw(v.viewMatrix, v.projMatrix);
    });

    // Update the text overlay with current camera information
    updateText(text1, `Camera pos: (${cameraPos[0].toFixed(1)}, ${cameraPos[1].toFixed(1)}, ${cameraPos[2].toFixed(1)}) | Yaw: ${yaw.toFixed(1)}° | Pitch: ${pitch.toFixed(1)}°`);

    requestAnimationFrame(render);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('Failed to initialize WebGL');
        }

        await initShader();

        // Target locations for the 5 cubes
        const locations = [
            vec3.fromValues( 0.0, 0.0, 0.0),
            vec3.fromValues( 2.0, 0.5,-3.0),
            vec3.fromValues(-1.5,-0.5,-2.5),
            vec3.fromValues( 3.0, 0.0,-4.0),
            vec3.fromValues(-3.0, 0.0, 1.0)
        ];

        // Initialize model matrices based on locations
        locations.forEach((v, i) => {
            modelMatrixes.push(mat4.create());
            mat4.translate(modelMatrixes[i], mat4.create(), v);
        });

        // Set fixed View matrix for the right viewport (Top-Down)
        mat4.lookAt(viewports[1].viewMatrix,
            vec3.fromValues(0, 15, 0), // from position (top)
            vec3.fromValues(0, 0, 0),  // target position (origin)
            vec3.fromValues(0, 0, -1)  // up vector
        );

        // Set Projection matrix for the left viewport (Perspective)
        mat4.perspective(
            viewports[0].projMatrix,
            glMatrix.toRadian(60),
            700 / 700,
            0.1,
            100.0
        );

        // Set Projection matrix for the right viewport (Orthographic)
        mat4.ortho(
            viewports[1].projMatrix,
            -10, 10, -10, 10,
            0.1,
            100.0
        );

        // Initialize timing variables
        startTime = Date.now();
        lastFrameTime = startTime;

        // Setup text overlays
        text1 = setupText(canvas, "Camera pos: (x.x, y.y, z.z) | Yaw: ddd.d° | Pitch: ddd.d°", 1);
        setupText(canvas, "WASD: move | Mouse: rotate (click to lock) | ESC: unlock", 2);
        setupText(canvas, "Left: Perspective | Right: Orthographic (Top-Down)", 3);
        
        requestAnimationFrame(render);

        return true;

    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('Failed to initialize program');
        return false;
    }
}