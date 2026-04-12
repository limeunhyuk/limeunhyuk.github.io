/*-------------------------------------------------------------------------
squarePyramid.js

Square Pyramid geometry:
- Bottom face: dx = dz = 1, centered at (0,0,0) on xz plane (y=0)
- Apex at (0, 1, 0)
- 5 vertices, drawn with triangles
---------------------------------------------------------------------------*/

export class SquarePyramid {
    constructor(gl) {
        this.gl = gl;
        this.initBuffers();
    }

    initBuffers() {
        const gl = this.gl;

        /*
            Vertices:
              v0: bottom-left-front  (-0.5, 0,  0.5)
              v1: bottom-right-front ( 0.5, 0,  0.5)
              v2: bottom-right-back  ( 0.5, 0, -0.5)
              v3: bottom-left-back   (-0.5, 0, -0.5)
              v4: apex               ( 0,   1,  0  )
        */

        // positions (x, y, z)
        const positions = new Float32Array([
            // Bottom face (2 triangles, y=0)
            -0.5, 0,  0.5,   // v0
             0.5, 0,  0.5,   // v1
             0.5, 0, -0.5,   // v2

            -0.5, 0,  0.5,   // v0
             0.5, 0, -0.5,   // v2
            -0.5, 0, -0.5,   // v3

            // Front face (v0, v1, v4)
            -0.5, 0,  0.5,   // v0
             0.5, 0,  0.5,   // v1
             0.0, 1,  0.0,   // v4

            // Right face (v1, v2, v4)
             0.5, 0,  0.5,   // v1
             0.5, 0, -0.5,   // v2
             0.0, 1,  0.0,   // v4

            // Back face (v2, v3, v4)
             0.5, 0, -0.5,   // v2
            -0.5, 0, -0.5,   // v3
             0.0, 1,  0.0,   // v4

            // Left face (v3, v0, v4)
            -0.5, 0, -0.5,   // v3
            -0.5, 0,  0.5,   // v0
             0.0, 1,  0.0,   // v4
        ]);

        // colors (r, g, b, a) per vertex
        const colors = new Float32Array([
            // Bottom face - dark gray
            0.2, 0.2, 0.2, 1.0,
            0.2, 0.2, 0.2, 1.0,
            0.2, 0.2, 0.2, 1.0,
            0.2, 0.2, 0.2, 1.0,
            0.2, 0.2, 0.2, 1.0,
            0.2, 0.2, 0.2, 1.0,

            // Front face (+Z): RED
            1.0, 0.0, 0.0, 1.0,
            1.0, 0.0, 0.0, 1.0,
            1.0, 0.0, 0.0, 1.0,

            // Right face (+X): YELLOW
            1.0, 1.0, 0.0, 1.0,
            1.0, 1.0, 0.0, 1.0,
            1.0, 1.0, 0.0, 1.0,

            // Back face (-Z): MAGENTA
            1.0, 0.0, 1.0, 1.0,
            1.0, 0.0, 1.0, 1.0,
            1.0, 0.0, 1.0, 1.0,

            // Left face (-X): CYAN
            0.0, 1.0, 1.0, 1.0,
            0.0, 1.0, 1.0, 1.0,
            0.0, 1.0, 1.0, 1.0,
        ]);

        this.vertexCount = 18; // 6 faces * 3 vertices (bottom=2tri=6, sides=4tri=12)

        // Position buffer
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        // Color buffer
        this.colorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    }

    draw(shader) {
        const gl = this.gl;

        // Bind position buffer to location 0
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        // Bind color buffer to location 2
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    }

    delete() {
        const gl = this.gl;
        gl.deleteBuffer(this.positionBuffer);
        gl.deleteBuffer(this.colorBuffer);
    }
}
