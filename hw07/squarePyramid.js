/*-----------------------------------------------------------------------------
squarePyramid.js

-----------------------------------------------------------------------------*/

export class SquarePyramid {
    constructor(gl, options = {}) {
        this.gl = gl;
        this.initBuffers();
    }
    
    initBuffers() {
        const gl = this.gl;

        // Initializing data
        this.positions = new Float32Array([
            // bottom1  (v1,v0,v3)
            -0.5,  0.0,  0.5,   0.5,  0.0,  0.5,   0.5,  0.0, -0.5,
            // bottom2  (v3,v2,v1)
             0.5,  0.0, -0.5,  -0.5,  0.0, -0.5,  -0.5,  0.0,  0.5,
            // front    (v0,v1,v4)
             0.5,  0.0,  0.5,  -0.5,  0.0,  0.5,   0.0,  1.0,  0.0,
            // back     (v2,v3,v4)
            -0.5,  0.0, -0.5,   0.5,  0.0, -0.5,   0.0,  1.0,  0.0,
            // left     (v1,v2,v4)
            -0.5,  0.0,  0.5,  -0.5,  0.0, -0.5,   0.0,  1.0,  0.0,
            // right    (v3,v0,v4)
             0.5,  0.0, -0.5,   0.5,  0.0,  0.5,   0.0,  1.0,  0.0
        ]);

        // this.colors = new Float32Array([
        //     // bottom1 (v1,v0,v3) - red
        //     1, 0, 0, 1,   1, 0, 0, 1,   1, 0, 0, 1,
        //     // bottom2 (v3,v2,v1) - red
        //     1, 0, 0, 1,   1, 0, 0, 1,   1, 0, 0, 1,
        //     // front (v0,v1,v4) - yellow
        //     1, 1, 0, 1,   1, 1, 0, 1,   1, 1, 0, 1,
        //     // back (v2,v3,v4) - green
        //     0, 1, 0, 1,   0, 1, 0, 1,   0, 1, 0, 1,
        //     // left (v1,v2,v4) - cyan
        //     0, 1, 1, 1,   0, 1, 1, 1,   0, 1, 1, 1,
        //     // right (v3,v0,v4) - blue
        //     0, 0, 1, 1,   0, 0, 1, 1,   0, 0, 1, 1,
        // ]);

        this.texCoords = new Float32Array([
            // bottom1   (v1,v0,v3)
             0.0,  1.0,   0.0,  0.0,   1.0,  0.0,
            // bottom2   (v3,v2,v1) 
             1.0,  0.0,   1.0,  1.0,   0.0,  1.0,
            // front     (v0,v1,v4) 
             0.0,  0.0,   0.25, 0.0,   0.125,  1.0,
            // back      (v2,v3,v4) 
            0.25,  0.0,   0.5,  0.0,   0.375,  1.0,
            // left      (v1,v2,v4) 
             0.5,  0.0,   0.75, 0.0,   0.625,  1.0,
            // right     (v3,v0,v4) 
            0.75,  0.0,   1.0,  0.0,   0.875,  1.0
        ]);

        this.vertexCount = 18;  // 6 face * 3 vertices each

        // bind vao
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        // Position buffer
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        // Color buffer
        // this.colorBuffer = gl.createBuffer();
        // gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        // gl.bufferData(gl.ARRAY_BUFFER, this.colors, gl.STATIC_DRAW);

        // gl.enableVertexAttribArray(2);
        // gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);

        // Texure buffer
        this.textureBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.textureBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.texCoords, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, 0);

        // unbind vao
        gl.bindVertexArray(null);
    }

    draw(shader) {
        const gl = this.gl;

        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    }

    delete() {
        const gl = this.gl;
        gl.deleteBuffer(this.vbo);
        gl.deleteBuffer(this.ebo);
        gl.deleteVertexArray(this.vao);
    }
} 