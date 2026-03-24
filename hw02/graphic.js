import { resizeAspectRatio, setupText } from "../util/util.js"
import { Shader, readShaderFile } from '../util/shader.js';

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');

if(!gl) {
    console.log('webgl2 not supported in your browser');
}

// 1) initial canvas size: 600 * 600
canvas.width = 600;
canvas.height = 600;
let translationX = 0.0; // 박스 이동용 변수
let translationY = 0.0; // 박스 이동용 변수
const boxSize = 0.1;    // 2) each edge = 0.2, 실제 박스 edge의 절반으로
const boxSpeed = 0.01;  // 3) 한 번 누를 때 +-0.01씩 이동
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};
let shader;
let vao;

gl.viewport(0,0,canvas.width, canvas.height);


// 쉐이더 컴파일까지 알아서
async function initShader() {
    // 6) 쉐이더는 독립된 파일로 저장 및 읽기
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

// VAO 템플릿
function setVAO(gl, vertexSource) {
    // Create Vertex Array Object (VAO)
    vao = gl.createVertexArray();
    // bind VAO
    gl.bindVertexArray(vao);

    // VBO 버퍼 생성
    const vertexBuffer = gl.createBuffer();

    // 만든 VBO 버퍼를 ARRAY_BUFFER에 꽂기 (CPU - GPU 연결)
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

    // ARRAY_BUFFER에 인자로 받은 vertex값 넣기
    gl.bufferData(gl.ARRAY_BUFFER, vertexSource, gl.STATIC_DRAW);

    // 셰이더가 값 어떻게 해석할지 설정
    // 한 번에 데이터 2개씩, 개당 사이즈는 FLOAT(4byte)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);    // for 2D coordinates

    // unbind VAO
    gl.enableVertexAttribArray(0);
    gl.bindVertexArray(null);
}

// render
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    move();

    // use rectangle buffer
    gl.bindVertexArray(vao);
    // draw rectangle, 5) without index; primitive: TRIANGLE_FAN
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

    // 그냥 render() 재귀보다 좋은 렌더링
    requestAnimationFrame(render);
}

function move() {
    const isAnyKeyPressed = Object.values(keys).includes(true);
    // 아무 키도 안 눌려 있으면 스킵
    if (isAnyKeyPressed) {
        // 매 프레임마다 0.01씩 이동
        let nextTranslationX = translationX;    // 이동 후 사각형이 캔버스 나갈지 미리 판정
        let nextTranslationY = translationY;    // 이동 후 사각형이 캔버스 나갈지 미리 판정
        if(keys['ArrowUp']) {
            nextTranslationY += boxSpeed;
        }
        if(keys['ArrowDown']) {
            nextTranslationY -= boxSpeed;
        }
        if(keys['ArrowLeft']) {
            nextTranslationX -= boxSpeed;
        }
        if(keys['ArrowRight']) {
            nextTranslationX += boxSpeed;
        }
        
        // 사각형 이동 후에 캔버스 나가는지 판정, 안전할 때만 업데이트
        if(-1.0 + boxSize <= nextTranslationX && nextTranslationX <= 1.0 - boxSize) {
            translationX = nextTranslationX;
        }
        if(-1.0 + boxSize <= nextTranslationY && nextTranslationY <= 1.0 - boxSize) {
            translationY = nextTranslationY;
        }
    }
    // 4) modify rectangle's coordinate with uniform variable
    // setVec2 함수는 /util/shader.js의 Shader 클래스에 정의되어 있음
    shader.setVec2("uOffset", translationX, translationY);
}

function setKeyEvents() {
    window.addEventListener('keydown', (e) => {
        if (e.key in keys) keys[e.key] = true;
    });
    window.addEventListener('keyup', (e) => {
        if (e.key in keys) keys[e.key] = false;
    });
}

// ======== main =========

// 셰이더 초기화 및 사용
await initShader();
shader.use();

// Rectangle vertex source
const squareVertices = new Float32Array([
    -boxSize, -boxSize,  // Bottom left
     boxSize, -boxSize,  // Bottom right
     boxSize,  boxSize,  // Top right
    -boxSize,  boxSize   // Top left
]);

// VAO 준비
setVAO(gl, squareVertices);

// set background color
gl.clearColor(0.0, 0.0, 0.0, 1.0);

// 7) message 표시
// setupText: /util/util.js에 정의
setupText(canvas, "Use arrow keys to move the rectangle");

// 8) builtin window resize EventHandler from /util/util.js
setKeyEvents();
resizeAspectRatio(gl, canvas);

render();