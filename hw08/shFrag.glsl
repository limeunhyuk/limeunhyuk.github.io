#version 300 es

precision highp float;

in vec3 fragPos;  
in vec3 normal;
in vec3 gouraudColor;

out vec4 FragColor;

struct Material {
    vec3 diffuse;
    vec3 specular;
    float shininess;
};

struct Light {
    vec3 position;
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

uniform Material material;
uniform Light light;
uniform vec3 u_viewPos;

// 0: Gouraud, 1: Phong
uniform highp int u_renderMode; 

void main() {
    if (u_renderMode == 0) {
        FragColor = vec4(gouraudColor, 1.0);
    } else {
        // Phong Shading:
        // ambient
        vec3 rgb = material.diffuse;
        vec3 ambient = light.ambient * rgb;
        
        // diffuse 
        vec3 norm = normalize(normal);
        vec3 lightDir = normalize(light.position - fragPos);
        float dotNormLight = dot(norm, lightDir);
        float diff = max(dotNormLight, 0.0);
        vec3 diffuse = light.diffuse * diff * rgb;  
        
        // specular
        vec3 viewDir = normalize(u_viewPos - fragPos);
        vec3 reflectDir = reflect(-lightDir, norm);
        float spec = 0.0;
        if (dotNormLight > 0.0) {
            spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
        }
        vec3 specular = light.specular * spec * material.specular;  
            
        vec3 result = ambient + diffuse + specular;
        FragColor = vec4(result, 1.0);
    }
}