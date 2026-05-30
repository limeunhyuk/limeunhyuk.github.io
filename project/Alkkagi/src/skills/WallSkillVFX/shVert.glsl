varying vec2 vUv;
uniform float uTime;
uniform vec2 uBigWavesFrequency;
uniform float uBigWavesSpeed;
uniform float uBigWavesElevation;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * modelPosition;
}