/*-------------------------------------------------------------------------
Homework05.js

- Viewing a square pyramid at origin with perspective projection
- The pyramid is fixed (no rotation)
- A camera is rotating around the origin:
    x, z: circular path with radius = 3, speed = 90 deg/sec
    y: oscillates from 0 to 10 using Math.sin(), speed = 45 deg/sec
- The camera is always looking at the origin.
---------------------------------------------------------------------------*/

import { resizeAspectRatio, Axes } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';
import { SquarePyramid } from './squarePyramid.js';

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let shader;
let startTime;
let lastFrameTime;

let isInitialized = false;

let viewMatrix = mat4.create();
let projMatrix = mat4.create();
let modelMatrix = mat4.create();

const cameraCircleRadius = 3.0;
const cameraXZSpeed = 90.0;   // deg/sec for x, z circular motion
const cameraYSpeed  = 45.0;   // deg/sec for y oscillation

const pyramid = new SquarePyramid(gl);
const axes = new Axes(gl, 1.8);

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

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }

    canvas.width = 700;
    canvas.height = 700;
    resizeAspectRatio(gl, canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    // Background color: dark navy (23, 43, 66) -> (0.09, 0.169, 0.259)
    gl.clearColor(0.09, 0.169, 0.259, 1.0);

    return true;
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

function render() {
    const currentTime = Date.now();
    const elapsedTime = (currentTime - startTime) / 1000.0; // seconds
    lastFrameTime = currentTime;

    // Clear canvas
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    // Model matrix: pyramid is fixed, no rotation
    // modelMatrix stays as identity

    // Camera position
    // x, z: circular path, radius=3, speed=90 deg/sec
    let camX = cameraCircleRadius * Math.sin(glMatrix.toRadian(cameraXZSpeed * elapsedTime));
    let camZ = cameraCircleRadius * Math.cos(glMatrix.toRadian(cameraXZSpeed * elapsedTime));

    // y: 0 ~ 10, using sin, speed=45 deg/sec
    // sin ranges from -1 to 1, map to 0~10: (sin + 1) / 2 * 10
    let camY = 5.0 + 5.0 * Math.sin(glMatrix.toRadian(cameraYSpeed * elapsedTime));

    // Viewing transformation matrix
    mat4.lookAt(viewMatrix,
        vec3.fromValues(camX, camY, camZ), // camera position
        vec3.fromValues(0, 0, 0),           // look at origin
        vec3.fromValues(0, 1, 0));          // up vector

    // Draw pyramid
    shader.use();
    shader.setMat4('u_model', modelMatrix);
    shader.setMat4('u_view', viewMatrix);
    shader.setMat4('u_projection', projMatrix);
    pyramid.draw(shader);

    // Draw axes
    axes.draw(viewMatrix, projMatrix);

    requestAnimationFrame(render);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL initialization failed');
        }

        await initShader();

        // Projection transformation matrix
        mat4.perspective(
            projMatrix,
            glMatrix.toRadian(60),          // field of view
            canvas.width / canvas.height,   // aspect ratio
            0.1,                            // near
            100.0                           // far
        );

        // starting time for animation
        startTime = lastFrameTime = Date.now();

        requestAnimationFrame(render);

        return true;
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('Failed to initialize program');
        return false;
    }
}
