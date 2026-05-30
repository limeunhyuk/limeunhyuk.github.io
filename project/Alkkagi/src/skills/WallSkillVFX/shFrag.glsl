varying vec2 vUv;
uniform float uTime;
uniform float uHitTime;

uniform float uMeshRatio;   // height/width of mesh(rectangle)
uniform vec2 uHitPosition;
uniform float uWaveSpeed;
uniform float uWaveWidth;
uniform float uEdgeGlowWidth;
uniform vec3 uBaseColor;

void main() {
    vec2 a = abs(vUv-0.5);
    a.y *= uMeshRatio;
    float b1 = min(0.5 - a.x, uMeshRatio / 2.0 - a.y);
    float edgeGlow = smoothstep(uEdgeGlowWidth, 0.0, b1);

    float t = uWaveSpeed * pow(uTime - uHitTime, 1.7) / 30000.;
    float threshold = 0.03;

    a = vUv - uHitPosition;
    a.y *= uMeshRatio;
    float b2 = length(a) - t;
    float circleEffect = 2. * min(.5, min(smoothstep(0.0, threshold, b2), smoothstep(threshold, 0.0, b2 - uWaveWidth)));

    float b = max(edgeGlow, circleEffect);

    vec3 finalColor = vec3(uBaseColor + b*.05);
    float finalAlpha = 0.1 + b;

    gl_FragColor = vec4(finalColor, finalAlpha);
}
