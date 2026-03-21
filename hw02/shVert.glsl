#version 300 es
layout(location = 0) in vec3 aPos;

uniform vec2 uOffset;                   // 평행이동용 전역변수

void main() {
    vec2 pos = aPos.xy + uOffset;       // 평행이동 적용
    gl_Position = vec4(pos, 0.0, 1.0);  // Homogeneous coordinate로 변환
}