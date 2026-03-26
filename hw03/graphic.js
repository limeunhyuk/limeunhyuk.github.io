import { resizeAspectRatio, setupText, updateText, Axes } from "../util/util.js"
import { Shader, readShaderFile } from '../util/shader.js';

// ======== Global variables ========

// canvas, webgl
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let isInitialized = false;  // main이 실행되는 순간 true로 change

// shader, buffer variables
let shader;
let vao;
let positionBuffer;         // 2D position을 위한 VBO (Vertex Buffer Object)

// mouse draw variables
let drawType = 0;           // 마우스 클릭 시 draw할 도형 타입
const DRAW_TYPE = {         // drawType에 쓸 변수
    LINE: "LINE",
    CIRCLE: "CIRCLE"
}
let isDrawing = false;      // mouse button을 누르고 있는 동안 true로 change
let startPoint = null;      // mouse button을 누른 위치
let endPoint = null;        // mouse button을 뗀 위치, 마우스 누르고 있는 동안 계속 업데이트됨

// render objects
let circles = [];               // circle segment 정보들을 저장하는 array, 원 하나만 필요하지만 확장성을 위해 일단 배열로 만듦
let circleInfo = {              // 중심 좌표, 반지름 정보
    r: 0,
    cx: 0,
    cy: 0
}
let lines = [];                 // line segment 정보들을 저장하는 array, 선분 하나만 필요하지만 확장성을 위해 일단 배열로 만듦
let points = [];                // point 정보들을 저장하는 array
let axes = new Axes(gl, 0.85);  // x, y axes 그려주는 object (util.js)
let textOverlay;                // circle 정보 표시 text object
let textOverlay2;               // line segment 정보 표시 text object
let textOverlay3;               // intersection 정보 표시 text object

// ========== variables end ==========

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) { // true인 경우는 main이 이미 실행되었다는 뜻이므로 다시 실행하지 않음
        console.log("Already initialized");
        return;
    }

    main().then(success => { // call main function
        if (!success) {
            console.log('프로그램을 종료합니다.');
            return;
        }
        isInitialized = true;
    }).catch(error => {
        console.error('프로그램 실행 중 오류 발생:', error);
    });
});


function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }
    
    // 1) initial canvas size: 700 * 700
    canvas.width = 700;
    canvas.height = 700;

    resizeAspectRatio(gl, canvas);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.2, 0.3, 1.0);

    return true;
}

// set buffers, 이후에 따로 vertex를 넣어줘야 함
function setupBuffers() {
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    shader.setAttribPointer('a_position', 2, gl.FLOAT, false, 0, 0); // x, y 2D 좌표

    gl.bindVertexArray(null);
}

// 좌표 변환 함수: 캔버스 좌표를 WebGL 좌표로 변환
// 캔버스 좌표: 캔버스 좌측 상단이 (0, 0), 우측 하단이 (canvas.width, canvas.height)
// WebGL 좌표 (NDC): 캔버스 좌측 하단이 (-1, -1), 우측 상단이 (1, 1)
function convertToWebGLCoordinates(x, y) {
    return [
        (x / canvas.width) * 2 - 1,  // [0,canvas.width] -> [-1,1] linear map
        -((y / canvas.height) * 2 - 1) // [canvas.height,0] -> [-1,1] linear map
    ];
}

function setupMouseEvents() {
    // 마우스 클릭 시, startPoint값 갱신 및 draw 시작
    function handleMouseDown(event) {
        event.preventDefault();     // 웹 기본 마우스 클릭 동작 방지
        event.stopPropagation();    // 해당 이벤트는 본 HTML요소에서 처리, 상위 요소로 전파 방지

        const rect = canvas.getBoundingClientRect(); // canvas 크기,위치정보 가져오기 위한 중간 산물
        const x = event.clientX - rect.left;  // canvas상의 x 좌표
        const y = event.clientY - rect.top;   // canvas상의 y 좌표

        if(drawType != null) {  // drawType이 null만 아니라면, 일단 startPoint 저장 후 drawing 시작
            if (!isDrawing) {   // 이미 drawing 중이면 스킵
                // 캔버스 좌표를 WebGL 좌표로 변환하여 선분의 시작점을 설정
                let [glX, glY] = convertToWebGLCoordinates(x, y);
                startPoint = [glX, glY];
                isDrawing = true; // 이제 mouse button을 놓을 때까지 계속 true로 둠. 즉, mouse down 상태가 됨
            }
        }
    }

    // drawing 도중일 경우, endPoint값 갱신
    function handleMouseMove(event) {
        if (isDrawing) {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            let [glX, glY] = convertToWebGLCoordinates(x, y);
            endPoint = [glX, glY];
            render();
        }
    }

    function handleMouseUp() {
        if (isDrawing && endPoint) {
            if(drawType == DRAW_TYPE.CIRCLE) {
                const r = Math.sqrt((startPoint[0] - endPoint[0]) ** 2 + (startPoint[1] - endPoint[1]) ** 2);
                circles.push(createCircleVertices(startPoint[0], startPoint[1], r, 30));
                circleInfo.cx = startPoint[0];
                circleInfo.cy = startPoint[1];
                circleInfo.r = r;

                drawType = DRAW_TYPE.LINE;  // 선 그리기로 변경
            }
            else if(drawType == DRAW_TYPE.LINE) {

                // lines.push([...startPoint, ...tempEndPoint])
                //   : startPoint와 tempEndPoint를 펼쳐서 하나의 array로 합친 후 lines에 추가
                // ex) lines = [] 이고 startPoint = [1, 2], tempEndPoint = [3, 4] 이면,
                //     lines = [[1, 2, 3, 4]] 이 됨
                // ex) lines = [[1, 2, 3, 4]] 이고 startPoint = [5, 6], tempEndPoint = [7, 8] 이면,
                //     lines = [[1, 2, 3, 4], [5, 6, 7, 8]] 이 됨
    
                lines.push([...startPoint, ...endPoint]);
    
                updateText(textOverlay, "Line segment: (" + lines[0][0].toFixed(2) + ", " + lines[0][1].toFixed(2) + 
                    ") ~ (" + lines[0][2].toFixed(2) + ", " + lines[0][3].toFixed(2) + ")");
                updateText(textOverlay2, "Click and drag to draw the second line segment");

                const intersects = getIntersect(lines[0][0], lines[0][1], lines[0][2], lines[0][3], circleInfo.cx, circleInfo.cy, circleInfo.r);
                intersects.forEach((p) => {
                    points.push(new Float32Array(p));
                });
                drawType = null;
            }

            isDrawing = false;
            startPoint = null;
            endPoint = null;
            render();
        }
    }

    drawType = DRAW_TYPE.CIRCLE;
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
}

// returns array of circle segments
function createCircleVertices(cx, cy, radius, segments) {
    const vertices = [];
    
    for (let i = 0; i < segments; i++) {
        // 0도부터 360도까지 회전하며 좌표 계산
        const angle = (i * 2 * Math.PI) / segments;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        vertices.push(x, y);
    }
    return new Float32Array(vertices);
}

// calculate and render intersection points & texts
// TODO: AI티 지우기
function getIntersect(lx1, ly1, lx2, ly2, cx, cy, r) {
    // 1. 선분의 방향 벡터 (dx, dy)와 시작점에서 원의 중심까지의 벡터 (fx, fy) 계산
    const dx = lx2 - lx1;
    const dy = ly2 - ly1;
    const fx = lx1 - cx;
    const fy = ly1 - cy;

    // 2. 이차방정식 at^2 + 2bt + c = 0 의 계수 결정
    // t는 선분 위의 위치 비율 (0이면 시작점, 1이면 끝점)
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = (fx * fx + fy * fy) - (r * r);

    // 3. 판별식 (Discriminant) 계산: b^2 - 4ac
    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
        // 교점 없음
        return [];
    } else {
        // 판별식 루트 계산
        const sqrtDisc = Math.sqrt(discriminant);

        // 이차방정식의 해 t1, t2 계산 (근의 공식)
        const t1 = (-b - sqrtDisc) / (2 * a);
        const t2 = (-b + sqrtDisc) / (2 * a);

        const intersects = [];

        // t값이 0과 1 사이여야 실제 '선분' 위에 존재하는 교점임
        [t1, t2].forEach(t => {
            if (t >= 0 && t <= 1) {
                intersects.push([lx1 + t * dx, ly1 + t * dy]);
            }
        });

        return intersects;
    }
}

// render
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    shader.use();
    
    // 저장된 점/선/원 그리기
    for (let line of lines) {
        shader.setVec4("u_color", [1.0, 0.0, 1.0, 1.0]);

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(line), gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINES, 0, 2);
    }
    for (let circle of circles) {
        shader.setVec4("u_color", [1.0, 0.0, 1.0, 1.0]);

        gl.bufferData(gl.ARRAY_BUFFER, circle, gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINE_LOOP, 0, circle.length / 2);
    }
    for(let point of points) {
        console.log(point);
        shader.setVec4("u_color", [1.0, 1.0, 0.0, 1.0]);

        // gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0.1, 0.1]), gl.STATIC_DRAW);
        gl.bufferData(gl.ARRAY_BUFFER, point, gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.POINTS, 0, 1);
    }

    // 임시 선/원 그리기
    if (isDrawing && startPoint && endPoint) {
        if(drawType == DRAW_TYPE.LINE) {
            shader.setVec4("u_color", [0.5, 0.5, 0.5, 1.0]); // 임시 선분의 color는 회색
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...startPoint, ...endPoint]), 
            gl.STATIC_DRAW);
            gl.bindVertexArray(vao);
            gl.drawArrays(gl.LINES, 0, 2);
        }
        else if(drawType == DRAW_TYPE.CIRCLE) {
            shader.setVec4("u_color", [0.5, 0.5, 0.5, 1.0]); // 임시 선분의 color는 회색

            const r = Math.sqrt((startPoint[0] - endPoint[0]) ** 2 + (startPoint[1] - endPoint[1]) ** 2);
            const circle = createCircleVertices(startPoint[0], startPoint[1], r, 30);
            
            gl.bufferData(gl.ARRAY_BUFFER, circle, gl.STATIC_DRAW);
            gl.bindVertexArray(vao);
            gl.drawArrays(gl.LINE_LOOP, 0, circle.length / 2);
        }
    }

    // axes 그리기
    axes.draw(mat4.create(), mat4.create()); // 두 개의 identity matrix를 parameter로 전달
}


// 쉐이더 컴파일까지 알아서 템플릿
async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

// ======== main =========
async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
            return false; 
        }

        // 셰이더, 버퍼 초기화 및 사용
        await initShader();
        setupBuffers();
        shader.use();

        // setupTest: /util/util.js에 정의
        setupText(canvas, "Use arrow keys to move the rectangle");
        
        setupMouseEvents();

        render();

        return true;

    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}
