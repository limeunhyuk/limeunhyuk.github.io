import { resizeAspectRatio, Axes } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';
import { SquarePyramid } from './squarePyramid.js';
import { Arcball } from '../util/arcball.js';
import { loadTexture } from '../util/texture.js';

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');

let shader;
let isInitialized = false;

// coordinate transform matrix
let viewMatrix = mat4.create();
let projMatrix = mat4.create();
let modelMatrix = mat4.create();

// models & textures
const pyramid = new SquarePyramid(gl);  // 2) pyramid's location & size is same as Hw05
                                        // check ./squarePyramid.js
                                        // 3,4) texture uv coordinates
const axes = new Axes(gl, 2.2);
const texture = loadTexture(gl, true, './sunrise.jpg'); // load texture image file

// camera & arcball variable
let initialDistance = 5.0;
let arcBallMode = 'CAMERA';
const arcball = new Arcball(canvas, initialDistance, { rotation: 2.0, zoom: 0.0005 });

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

    // 1) canvas size: 700 * 700
    canvas.width = 700;
    canvas.height = 700;
    resizeAspectRatio(gl, canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    
    gl.clearColor(0.1, 0.2, 0.3, 1.0);
    
    return true;
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    viewMatrix = arcball.getViewMatrix();

    shader.use();
    shader.setMat4('u_model', modelMatrix);
    shader.setMat4('u_view', viewMatrix);
    shader.setMat4('u_projection', projMatrix);
    
    pyramid.draw(shader);

    axes.draw(viewMatrix, projMatrix);

    requestAnimationFrame(render);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL initialization failed');
        }
        
        await initShader();

        // modelmatrix: identity
        mat4.translate(viewMatrix, viewMatrix, vec3.fromValues(0, 0, -initialDistance));
        mat4.perspective(
            projMatrix,
            glMatrix.toRadian(60),  // field of view (fov, degree)
            canvas.width / canvas.height, // aspect ratio
            0.1, // near
            100.0 // far
        );

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        shader.use();
        shader.setInt('u_texture', 0);  // use texture

        requestAnimationFrame(render);

        return true;

    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('Failed to initialize program');
        return false;
    }
}