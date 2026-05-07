#version 300 es

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec4 a_color;
layout(location = 3) in vec2 a_texCoord;

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

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;

uniform vec3 u_viewPos;
uniform Material material;
uniform Light light;
uniform highp int u_renderMode; 

out vec3 fragPos;
out vec3 normal;
out vec3 gouraudColor;

void main() {
    vec3 worldPos = vec3(u_model * vec4(a_position, 1.0));
    vec3 worldNorm = mat3(transpose(inverse(u_model))) * a_normal;
    
    fragPos = worldPos;
    normal = worldNorm;
    
    gl_Position = u_projection * u_view * vec4(worldPos, 1.0);

    if (u_renderMode == 0) {
        vec3 norm = normalize(worldNorm);
        vec3 lightDir = normalize(light.position - worldPos);
        
        vec3 ambient = light.ambient * material.diffuse;
        
        float diff = max(dot(norm, lightDir), 0.0);
        vec3 diffuse = light.diffuse * (diff * material.diffuse);
        
        vec3 viewDir = normalize(u_viewPos - worldPos);
        vec3 reflectDir = reflect(-lightDir, norm);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
        vec3 specular = light.specular * (spec * material.specular);
        
        gouraudColor = ambient + diffuse + specular;
    } else {
        gouraudColor = vec3(0.0);
    }
}