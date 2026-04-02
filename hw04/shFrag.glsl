#version 300 es

precision mediump float;
uniform vec4 u_color; // 외부에서 받을 색상 변수
out vec4 FragColor;

void main() {
    FragColor = u_color;
}