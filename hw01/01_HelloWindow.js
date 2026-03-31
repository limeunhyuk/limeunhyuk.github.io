// Global constants
const canvas = document.getElementById('glCanvas'); // Get the canvas element 
const gl = canvas.getContext('webgl2'); // Get the WebGL2 context

if (!gl) {
    console.error('WebGL 2 is not supported by your browser.');
}

// Set canvas size: 현재 window 전체를 canvas로 사용
canvas.width = 500;
canvas.height = 500;

// Initialize WebGL settings: viewport and clear color
gl.viewport(0, 0, canvas.width, canvas.height);

// Quadrants draw function
function drawQuadrants() {
    gl.enable(gl.SCISSOR_TEST);
    const halfH = canvas.height / 2;
    const halfW = canvas.width / 2;
    gl.scissor(0, halfH, halfW, halfH);
    gl.clearColor(0, 1, 0, 1.0);
    render();
    gl.scissor(halfW, halfH, halfW, halfH);
    gl.clearColor(1, 0, 0, 1.0);
    render();
    gl.scissor(0, 0, halfW, halfH);
    gl.clearColor(0, 0, 1, 1.0);
    render();
    gl.scissor(halfW, 0, halfW, halfH);
    gl.clearColor(1, 1, 0, 1.0);
    render();
    gl.disable(gl.SCISSOR_TEST);
}

// render
drawQuadrants();

// Render loop
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Draw something here
}

// Resize viewport when window size changes
window.addEventListener('resize', () => {
    canvas.width = Math.min(window.innerWidth, window.innerHeight);
    canvas.height = Math.min(window.innerWidth, window.innerHeight);
    gl.viewport(0, 0, canvas.width, canvas.height);
    drawQuadrants();
});

