import LoadTexture from "./TextureHandler.mjs"

let tg = Math.tan;
let sin = Math.sin;
let cos = Math.cos;

function get(name) {
    return parseFloat(document.getElementById(name).value);
}

function normalizeUV(value, min, max) {
    return (value - min) / (max - min);
}

function ModelBuilder() {
    const h = get('H');
    const c = get('C');
    const a = get('A');
    const p = parseInt(get('K')) * Math.PI;
    const f = get('F');
    
    const uSteps = get('USteps');
    const vSteps = get('VSteps');

    const uMin = get('UMin');
    const uMax = get('UMax');

    const vMin = get('VMin');
    const vMax = get('VMax');

    const du = (uMax - uMin) / uSteps;
    const dv = (vMax - vMin) / vSteps;

    this.sigma = function(u) {
        return p * u;
    }

    this.fx = function(u, v) {
        let s = this.sigma(u);
        return (c * u) + v * (sin(f) + tg(a) * cos(f) * cos(s));
    }

    this.fy = function(u, v) {
        return v * tg(a) * sin(this.sigma(u));
    }

    this.fz = function(u, v) {
        return h + v * (tg(a) * sin(f) * cos(this.sigma(u)) - cos(f));
    }

    this.dx_du = function(u, v) {
        let s = this.sigma(u);
        return c + v * (Math.cos(f) * Math.tan(a) * -Math.sin(s) * p);
    };
    
    this.dx_dv = function(u, v) {
        let s = this.sigma(u);
        return Math.sin(f) + Math.tan(a) * Math.cos(f) * Math.cos(s);
    };
    
    this.dy_du = function(u, v) {
        return v * Math.tan(a) * Math.cos(this.sigma(u)) * p;
    };
    
    this.dy_dv = function(u, v) {
        return Math.tan(a) * Math.sin(this.sigma(u));
    };
    
    this.dz_du = function(u, v) {
        let s = this.sigma(u);
        return v * (Math.tan(a) * Math.sin(f) * -Math.sin(s) * p);
    };
    
    this.dz_dv = function(u, v) {
        let s = this.sigma(u);
        return Math.tan(a) * Math.sin(f) * Math.cos(s) - Math.cos(f);
    };

    this.build = function() {
        const vertices = [];
        const normals = [];
        const tangents = [];
        const uvs = [];
        const indices = [];

        let max_x = undefined;
        let min_x = undefined;

        for (let i = 0; i <= uSteps; i++) {
            const u = uMin + i * du;
            for (let j = 0; j <= vSteps; j++) {
                const v = vMin + j * dv;
         
                const x = this.fx(u, v);

                max_x = max_x == undefined ? x : Math.max(x, max_x);
                min_x = min_x == undefined ? x : Math.min(x, min_x);

                const y = this.fy(u, v);
                const z = this.fz(u, v);
    
                vertices.push(x, y, z);

                const tangent_u = m4.normalize([
                    this.dx_du(u, v),
                    this.dy_du(u, v),
                    this.dz_du(u, v)
                ], [0, 1, 0]);
    
                const tangent_v = m4.normalize([
                    this.dx_dv(u, v),
                    this.dy_dv(u, v),
                    this.dz_dv(u, v)
                ], [1, 0, 0]);
    
                normals.push(...m4.normalize(m4.cross(tangent_u, tangent_v, []), [0, 0, 1]));
                tangents.push(...tangent_u);
                uvs.push(normalizeUV(u, uMin, uMax), normalizeUV(v, vMin, vMax));
            }
        }

        for(let i = 0; i < vertices.length; i += 3) {
            vertices[i] -= (max_x - min_x) / 2.0;
        }

        for (let i = 0; i < uSteps; i++) {
            for (let j = 0; j < vSteps; j++) {
                const topLeft = i * (vSteps + 1) + j;
                const topRight = i * (vSteps + 1) + (j + 1);
                const bottomLeft = (i + 1) * (vSteps + 1) + j;
                const bottomRight = (i + 1) * (vSteps + 1) + (j + 1);

                indices.push(topLeft, bottomLeft, bottomRight);
                indices.push(topLeft, bottomRight, topRight);
            }
        }

        return { vertices, normals, tangents, uvs, indices };
    }
}

export default function Model(gl, shProgram) {
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iTangentBuffer = gl.createBuffer();
    this.iUVBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();

    this.idTextureDiffuse = LoadTexture(gl, "./textures/diffuse.jpg");
    this.idTextureNormal = LoadTexture(gl, "./textures/normal.jpg");
    this.idTextureSpecular = LoadTexture(gl, "./textures/specular.jpg");

    this.point = [0.5, 0.5];
    this.uvBuffer = [];
    this.indexBuffer = [];

    this.count = 0;

    this.BufferData = function(vertices, normals, tangents, uvs, indices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tangents), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iUVBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

        this.uvBuffer = uvs;
        this.indexBuffer = indices;

        this.count = indices.length;
    };

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTangent, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTangent);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iUVBuffer);
        gl.vertexAttribPointer(shProgram.iAttribUV, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribUV);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureDiffuse);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureNormal);
        
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureSpecular);

        gl.uniform2fv(shProgram.iPoint, this.point);
        gl.uniform2fv(shProgram.iScale, [get('SU'), get('SV')]);

        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_INT, 0);
    }

    this.CreateSurfaceData = function() {
        let builder = new ModelBuilder();
        const { vertices, normals, tangents, uvs, indices } = builder.build();
        this.BufferData(vertices, normals, tangents, uvs, indices);
    }
}
