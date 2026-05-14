#version 300 es

precision highp float;

out vec4 FragColor;
in vec3 fragPos;  
in vec3 normal;  
in vec2 texCoord;

struct Material {
    sampler2D diffuse; // diffuse map
    vec3 specular;     // 표면의 specular color
    float shininess;   // specular 반짝임 정도
};

struct Light {
    //vec3 position;
    vec3 direction;
    vec3 ambient; // ambient 적용 strength
    vec3 diffuse; // diffuse 적용 strength
    vec3 specular; // specular 적용 strength
};

uniform Material material;
uniform Light light;
uniform vec3 u_viewPos;
uniform float u_toonLevels;

void main() {
    // ambient
    vec3 rgb = vec3(0.8, 0.4, 0.15);
    vec3 ambient = light.ambient * rgb;
  	
    // diffuse 
    vec3 norm = normalize(normal);
    vec3 lightDir = normalize(light.direction);
    float dotNormLight = dot(norm, lightDir);
    float diff = max(dotNormLight, 0.0);

    // [Toon Shading] Diffuse 양자화
    diff = floor(diff * u_toonLevels) / u_toonLevels; 

    vec3 diffuse = light.diffuse * diff * rgb;  

    // specular
    vec3 viewDir = normalize(u_viewPos - fragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = 0.0;
    if (dotNormLight > 0.0) {
        spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);

        // [Toon Shading] Specular 양자화
        spec = floor(spec * u_toonLevels) / u_toonLevels;
    }
    vec3 specular = light.specular * spec * material.specular;  

    vec3 result = ambient + diffuse + specular;
    FragColor = vec4(result, 1.0);
} 