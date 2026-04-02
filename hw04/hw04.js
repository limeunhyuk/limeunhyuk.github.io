import { resizeAspectRatio, setupText, updateText, Axes } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';

let isInitialized = false;
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let shader;
let vao;
let axes;
let isAnimating = true;
let lastTime = 0;

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) {
        console.log("Already initialized");
        return;
    }

    main().then(success => {
        if (!success) {
            console.log('프로그램을 종료합니다.');
            return;
        }
        isInitialized = true;
        requestAnimationFrame(animate);
    }).catch(error => {
        console.error('프로그램 실행 중 오류 발생:', error);
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
    gl.clearColor(0.2, 0.3, 0.4, 1.0);
    
    return true;
}

function setupBuffers() {
    const cubeVertices = new Float32Array([
        -1,  1,  // 좌상단
        -1, -1,  // 좌하단
         1, -1,  // 우하단
         1,  1   // 우상단
    ]);

    const indices = new Uint16Array([
        0, 1, 2,    // 첫 번째 삼각형
        0, 2, 3     // 두 번째 삼각형
    ]);

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // VBO for position
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);
    shader.setAttribPointer("a_position", 2, gl.FLOAT, false, 0, 0);
    
    // EBO
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
}

// translate한 Instance를 scale, color 처리 후 출력
function drawInstance(baseMatrix, scaleVector, colorVector) {
    const drawMatrix = mat4.create();
    mat4.scale(drawMatrix, baseMatrix, scaleVector);
    
    shader.setVec4("u_color", colorVector);
    shader.setMat4("u_transform", drawMatrix);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

function render(angleMain, angleSmall) {
    gl.clear(gl.COLOR_BUFFER_BIT);

    shader.use();
    gl.bindVertexArray(vao);

    // 1. 기둥 (Pillar)
    const M_pillar = mat4.create();
    mat4.translate(M_pillar, M_pillar, [0.0, -0.2, 0.0]); 
    drawInstance(M_pillar, [0.1, 0.5, 1.0], [0.6, 0.3, 0.1, 1.0]);

    // 2. 큰 날개 (Main Blade)
    const M_main = mat4.create();
    mat4.translate(M_main, mat4.create(), [0.0, 0.3, 0.0]); 
    mat4.rotateZ(M_main, M_main, angleMain); 
    drawInstance(M_main, [0.3, 0.045, 1.0], [1.0, 1.0, 1.0, 1.0]);

    // 3. 왼쪽 작은 날개 (Small Blade 1)
    const M_small1 = mat4.create();
    mat4.copy(M_small1, M_main); 
    mat4.translate(M_small1, M_small1, [-0.3, 0.0, 0.0]); 
    mat4.rotateZ(M_small1, M_small1, angleSmall);
    drawInstance(M_small1, [0.08, 0.02, 1.0], [0.7, 0.7, 0.7, 1.0]);

    // 4. 오른쪽 작은 날개 (Small Blade 2)
    const M_small2 = mat4.create();
    mat4.copy(M_small2, M_main); 
    mat4.translate(M_small2, M_small2, [0.3, 0.0, 0.0]); 
    mat4.rotateZ(M_small2, M_small2, angleSmall);
    drawInstance(M_small2, [0.08, 0.02, 1.0], [0.7, 0.7, 0.7, 1.0]);
}

let startTime = 0;

function animate(currentTime) {
    if (!startTime) startTime = currentTime;
    
    const elapsedTime = (currentTime - startTime) / 1000; 
    
    const angleMain = Math.sin(elapsedTime) * Math.PI * 2.0;
    const angleSmall = Math.sin(elapsedTime) * Math.PI * -10.0;

    render(angleMain, angleSmall);
    requestAnimationFrame(animate);
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
        }
        
        await initShader();
        setupBuffers();

        requestAnimationFrame(animate);

    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}
