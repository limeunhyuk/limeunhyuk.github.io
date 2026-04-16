/*-------------------------------------------------------------------------
11_CameraFP.js (First Person Camera)

- Viewing a unit 3D cube at origin with perspective projection
- View transformation
   1) w, a, s, d keys: move the camera forward, left, backward, and right
   2) mouse horizontal movement: rotate the camera around the y-axis (yaw)
   3) mouse vertical movement: rotate the camera around the x-axis (pitch)
- Pointer lock
   1) At first, click the canvas to lock the pointer
   2) Move the mouse to rotate the camera, WASD keys to move the camera
   3) Escape key: Unlock the pointer
---------------------------------------------------------------------------*/
import { resizeAspectRatio, setupText, Axes, updateText } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';
import { Cube } from '../util/cube.js';

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let shader;
let startTime;  // start time of the program
let lastFrameTime;  // time of the last frame
let isInitialized = false;  // program initialization flag
let text1;  // text overlay of first line
const viewports = [{
        x: 0,
        y: 0,
        width: 700,
        height: 700,
        color: [0.1, 0.2, 0.3, 1.0],
        viewMatrix: mat4.create(),
        projMatrix: mat4.create()
    },
    {
        x: 700,
        y: 0,
        width: 700,
        height: 700,
        color: [0.05, 0.15, 0.2,1.0],
        viewMatrix: mat4.create(),
        projMatrix: mat4.create()
    }
];

let modelMatrix = mat4.create();  // model matrix
let viewMatrix = mat4.create();  // view matrix
let projMatrix = mat4.create();  // projection matrix
let modelMatrixes = [];
let viewMatrixes = [];
let projMatrixes = [];
const cube = new Cube(gl);  // create a Cube object
const axes = new Axes(gl, 2.0); // create an Axes object

// Global variables for camera position and orientation
let cameraPos = vec3.fromValues(0, 0, 5);  // camera position initialization
let cameraFront = vec3.fromValues(0, 0, -1); // camera front vector initialization
let cameraUp = vec3.fromValues(0, 1, 0); // camera up vector (invariant)
let yaw = -90;  // yaw angle, rotation about y-axis (degree)
let pitch = 0;  // pitch angle, rotation about x-axis (degree)
const mouseSensitivity = 0.1;  // mouse sensitivity
const cameraSpeed = 2.5;  // camera speed (unit distance/sec)

// global variables for keyboard input
const keys = {
    'w': false,
    'a': false,
    's': false,
    'd': false
};

// mouse 쓸 때 main call 방법
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

// keyboard event listener for document
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

// mouse event listener for canvas
canvas.addEventListener('click', () => {
    canvas.requestPointerLock();
    // Changing the pointer lock state
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

// camera update function
function updateCamera(e) {
    const xoffset = e.movementX * mouseSensitivity;  // movementX 사용
    const yoffset = -e.movementY * mouseSensitivity; // movementY 사용

    yaw += xoffset;
    pitch += yoffset;

    // pitch limit
    if (pitch > 89.0) pitch = 89.0;
    if (pitch < -89.0) pitch = -89.0;

    // camera direction calculation
    // sperical coordinates (r, theta, phi) = (r, yaw, pitch) = (sx, sy, sz)
    // sx = cos(yaw) * cos(pitch)
    // sy = sin(pitch)
    // sz = sin(yaw) * cos(pitch)
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
    const elapsedTime = (currentTime - startTime) / 1000.0;

    // camera movement based on keyboard input
    const cameraSpeedWithDelta = cameraSpeed * deltaTime;
    
    // vec3.scaleAndAdd(v1, v2, v3, s): v1 = v2 + v3 * s
    if (keys['w']) { // move camera forward (to the +cameraFront direction)
        vec3.scaleAndAdd(cameraPos, cameraPos, cameraFront, cameraSpeedWithDelta);
    }
    if (keys['s']) { // move camera backward (to the -cameraFront direction)
        vec3.scaleAndAdd(cameraPos, cameraPos, cameraFront, -cameraSpeedWithDelta);
    }
    if (keys['a']) { // move camera to the left (to the -cameraRight direction)
        const cameraRight = vec3.create();
        vec3.cross(cameraRight, cameraFront, cameraUp);
        vec3.normalize(cameraRight, cameraRight);
        vec3.scaleAndAdd(cameraPos, cameraPos, cameraRight, -cameraSpeedWithDelta);
    }
    if (keys['d']) { // move camera to the right (to the +cameraRight direction)
        const cameraRight = vec3.create();
        vec3.cross(cameraRight, cameraFront, cameraUp);
        vec3.normalize(cameraRight, cameraRight);
        vec3.scaleAndAdd(cameraPos, cameraPos, cameraRight, cameraSpeedWithDelta);
    }

    mat4.lookAt(viewports[0].viewMatrix, 
        cameraPos, // from position (camera position)
        vec3.add(vec3.create(), cameraPos, cameraFront), // target position (camera position + cameraFront)
        cameraUp); // up vector (camera up vector, usually (0, 1, 0) and invariant)

    // viewport 1
    viewports.forEach(v => {
        gl.viewport(v.x, v.y, v.width, v.height);
        gl.scissor(v.x, v.y, v.width, v.height);
        gl.clearColor(v.color[0], v.color[1], v.color[2], v.color[3]);

        // Clear canvas
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);

        // draw the cube
        shader.use();
        for(let i = 0; i < modelMatrixes.length; i++) {
            shader.setMat4('u_model', modelMatrixes[i]);
            shader.setMat4('u_view', v.viewMatrix);
            shader.setMat4('u_projection', v.projMatrix);
            cube.draw(shader);
        }

        // draw the axes
        axes.draw(v.viewMatrix, v.projMatrix);
    });
    
    // update text about camera information
    updateText(text1, `Camera pos: (${cameraPos[0].toFixed(1)}, ${cameraPos[1].toFixed(1)}, ${cameraPos[2].toFixed(1)}) | Yaw: ${yaw.toFixed(1)}° | Pitch: ${pitch.toFixed(1)}°`);
    
    requestAnimationFrame(render);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('Failed to initialize WebGL');
        }
        
        await initShader();
        
        const locations = [
            vec3.fromValues( 0.0, 0.0, 0.0),
            vec3.fromValues( 2.0, 0.5,-3.0),
            vec3.fromValues(-1.5,-0.5,-2.5),
            vec3.fromValues( 3.0, 0.0,-4.0),
            vec3.fromValues(-3.0, 0.0, 1.0)
        ];
        
        locations.forEach((v, i) => {
            modelMatrixes.push(mat4.create());
            mat4.translate(modelMatrixes[i], mat4.create(), v);
        });
        
        // View matrix for scene 2
        mat4.lookAt(viewports[1].viewMatrix, 
            vec3.fromValues(0, 15, 0), // from position
            vec3.fromValues(0, 0, 0), // target position
            vec3.fromValues(0, 0, -1) // up vector
        );
        
        // Projection matrix for scene 1
        mat4.perspective(
            viewports[0].projMatrix,
            glMatrix.toRadian(60),  // field of view (fov, degree)
            700 / 700, // aspect ratio
            0.1, // near
            100.0 // far
        );
        // Orthogonal Projection matrix for scene 2
        mat4.ortho(
            viewports[1].projMatrix,
            -10, 10, -10, 10, // left, right, bottom, top
            0.1, // near
            100.0 // far
        );
        
        // 시작 시간과 마지막 프레임 시간 초기화
        startTime = Date.now();
        lastFrameTime = startTime;
        
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
