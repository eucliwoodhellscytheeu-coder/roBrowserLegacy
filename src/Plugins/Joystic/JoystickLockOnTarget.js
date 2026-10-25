/**
 * Renderer/Effects/JoystickLockOnTarget.js
 *
 * ES6 conversion of the original AMD/RequireJS module.
 * Behavior preserved and runtime circular dependency resolved.
 */

import WebGL from 'Utils/WebGL.js';
import Texture from 'Utils/Texture.js';
import glMatrix from 'Utils/gl-matrix.js';
import Altitude from 'Renderer/Map/Altitude.js';

import Client from 'Core/Client.js';
import Session from 'Engine/SessionStorage.js';

const mat4 = glMatrix.mat4;

// Shared WebGL resources
let shaderProgram = null;
let vertexBuffer = null;
let texture = null;

// Shared rotation matrix
const rotationMatrix = mat4.create();

/**
 * Lock-on target effect.
 */
class JoystickLockOnTarget {
	/**
	 * @param {number} type
	 * @param {*} src
	 * @param {*} target
	 * @param {number} range
	 * @param {number} startLifeTime
	 * @param {number} endLifeTime
	 */
	constructor(type, src, target, range, startLifeTime, endLifeTime) {
		this.type = type;
		this.src = src;
		this.target = target;
		this.range = range;
		this.startLifeTime = startLifeTime;
		this.endLifeTime = endLifeTime;

		this.ready = false;
		this.needCleanUp = false;
	}

	/**
	 * Initialize an instance.
	 */
	init() {
		this.ready = true;
	}

	/**
	 * Free an instance.
	 */
	free() {
		this.ready = false;
	}

	/**
	 * Render this effect.
	 *
	 * @param {WebGLRenderingContext} gl
	 * @param {number} currentTime
	 */
	render(gl, currentTime) {
		if (this.cancelled) {
			this.needCleanUp = true;
			return;
		}
		if (!shaderProgram || !JoystickLockOnTarget.ready) {
			return;
		}

		let color = 1;

		/*
		 * Type 1:
		 * Lock-on animation attached directly to the target.
		 */
		if (this.type === 1) {
			const elapsed = currentTime - this.startLifeTime;

			color = 20 - (Math.floor(elapsed / 20) % 20);
			color /= 20;

			let size = Math.max(elapsed / 50, 1);
			size = Math.min(size, 5);

			gl.uniform3fv(shaderProgram.uniform.uPosition, this.target.position);

			gl.uniform1f(shaderProgram.uniform.uSize, 3 * (6 - size));

			gl.uniform1f(shaderProgram.uniform.uColor, color);

			gl.drawArrays(gl.TRIANGLES, 0, 6);

			this.needCleanUp = this.endLifeTime < currentTime;
			return;
		}

		/*
		 * Type other than 1:
		 * Position is calculated from source + target.
		 */
		const position = new Float32Array(3);

		position[0] = this.src[0] + this.target[0];
		position[1] = this.src[1] + this.target[1];
		position[2] = Altitude.getCellHeight(position[0], position[1]);

		const range = this.range + 1;

		const playerPos = Session && Session.Entity && Session.Entity.position ? Session.Entity.position : [0, 0, 0];

		const dx = playerPos[0] - position[0];
		const dy = playerPos[1] - position[1];

		/*
		 * Fade the lock-on effect when the player
		 * is outside the configured range.
		 */
		if (range * range <= dx * dx + dy * dy) {
			color = 0.2;
		}

		gl.uniform3fv(shaderProgram.uniform.uPosition, position);

		gl.uniform1f(shaderProgram.uniform.uSize, 3);

		gl.uniform1f(shaderProgram.uniform.uColor, color);

		gl.drawArrays(gl.TRIANGLES, 0, 6);

		/*
		 * Non-type-1 effects are managed externally or persistent.
		 */
		this.needCleanUp = false;
	}

	/**
	 * Initialize shared WebGL resources.
	 *
	 * @param {WebGLRenderingContext} gl
	 * @param {object} [client] Optional Client module reference to avoid circular import TDZ
	 */
	static init(gl, client) {
		const ClientModule = client || Client;

		if (!ClientModule) {
			console.error("JoystickLockOnTarget.init: 'Client' module unavailable.");
			return;
		}

		shaderProgram = WebGL.createShaderProgram(
			gl,
			`#version 300 es
#pragma vscode_glsllint_stage : vert

            precision highp float;

            in vec2 aPosition;
            in vec2 aTextureCoord;

            out vec2 vTextureCoord;

            uniform mat4 uModelViewMat;
            uniform mat4 uProjectionMat;
            uniform mat4 uRotationMat;

            uniform vec3 uPosition;
            uniform float uSize;

            void main(void) {
                vec4 position = vec4(
                    uPosition.x + 0.5,
                    -uPosition.z,
                    uPosition.y + 0.5,
                    1.0
                );

                position += vec4(
                    aPosition.x * uSize,
                    0.0,
                    aPosition.y * uSize,
                    0.0
                ) * uRotationMat;

                gl_Position = uProjectionMat * uModelViewMat * position;
                gl_Position.z -= 0.02;

                vTextureCoord = aTextureCoord;
            }
            `,
			`#version 300 es
out highp vec4 fragColor;
#pragma vscode_glsllint_stage : frag

            precision highp float;

            in vec2 vTextureCoord;

            uniform sampler2D uDiffuse;
            uniform float uColor;

            uniform bool uFogUse;
            uniform float uFogNear;
            uniform float uFogFar;
            uniform vec3 uFogColor;

            void main(void) {
                vec4 tex = texture(uDiffuse, vTextureCoord.st);

                if (tex.a == 0.0) {
                    discard;
                }

                fragColor = tex;
                fragColor.gb *= uColor;

                if (uFogUse) {
                    float depth = gl_FragCoord.z / gl_FragCoord.w;
                    float fogFactor = smoothstep(uFogNear, uFogFar, depth);

                    fragColor = mix(
                        fragColor,
                        vec4(uFogColor, fragColor.w),
                        fogFactor
                    );
                }
            }
            `
		);

		/*
		 * Create quad vertex buffer.
		 * Layout: x, y, u, v
		 */
		vertexBuffer = gl.createBuffer();

		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([
				-0.5, -0.5, 0, 0, 0.5, -0.5, 1, 0, 0.5, 0.5, 1, 1,

				0.5, 0.5, 1, 1, -0.5, 0.5, 0, 1, -0.5, -0.5, 0, 0
			]),
			gl.STATIC_DRAW
		);

		/*
		 * Load the lock-on texture dynamically without top-level import locks.
		 */
		ClientModule.loadFile('data/texture/effect/lockon128.tga', image => {
			Texture.load(image, function () {
				const context = this.getContext('2d');

				/*
				 * Rotate the texture by 45 degrees.
				 */
				context.save();
				context.translate(this.width / 2, this.height / 2);
				context.rotate(0.25 * Math.PI);
				context.translate(-this.width / 2, -this.height / 2);
				context.drawImage(this, 0, 0);
				context.restore();

				texture = gl.createTexture();

				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this);

				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

				JoystickLockOnTarget.ready = true;
			});
		});
	}

	/**
	 * Called before entities are rendered.
	 *
	 * @param {WebGLRenderingContext} gl
	 * @param {mat4} modelViewMatrix
	 * @param {mat4} projectionMatrix
	 * @param {object} fog
	 * @param {number} time
	 */
	static beforeRender(gl, modelViewMatrix, projectionMatrix, fog, time) {
		if (!shaderProgram || !JoystickLockOnTarget.ready) {
			return;
		}

		const uniforms = shaderProgram.uniform;
		const attributes = shaderProgram.attribute;

		/*
		 * Reuse the shared matrix.
		 */
		mat4.identity(rotationMatrix);
		mat4.rotateY(rotationMatrix, rotationMatrix, (time / 4 / 180) * Math.PI);

		gl.useProgram(shaderProgram);

		gl.uniformMatrix4fv(uniforms.uModelViewMat, false, modelViewMatrix);
		gl.uniformMatrix4fv(uniforms.uProjectionMat, false, projectionMatrix);
		gl.uniformMatrix4fv(uniforms.uRotationMat, false, rotationMatrix);

		gl.uniform1i(uniforms.uFogUse, fog && fog.use && fog.exist ? 1 : 0);
		gl.uniform1f(uniforms.uFogNear, fog ? fog.near : 0);
		gl.uniform1f(uniforms.uFogFar, fog ? fog.far : 0);
		gl.uniform3fv(uniforms.uFogColor, fog && fog.color ? fog.color : [0, 0, 0]);

		/*
		 * Bind lock-on texture.
		 */
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.uniform1i(uniforms.uDiffuse, 0);

		/*
		 * Vertex attributes.
		 */
		gl.enableVertexAttribArray(attributes.aPosition);
		gl.enableVertexAttribArray(attributes.aTextureCoord);

		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

		gl.vertexAttribPointer(attributes.aPosition, 2, gl.FLOAT, false, 16, 0);

		gl.vertexAttribPointer(attributes.aTextureCoord, 2, gl.FLOAT, false, 16, 8);
	}

	/**
	 * Called after all entities have rendered.
	 *
	 * @param {WebGLRenderingContext} gl
	 */
	static afterRender(gl) {
		if (!shaderProgram || !JoystickLockOnTarget.ready) {
			return;
		}

		gl.disableVertexAttribArray(shaderProgram.attribute.aPosition);
		gl.disableVertexAttribArray(shaderProgram.attribute.aTextureCoord);
	}

	/**
	 * Free shared WebGL resources.
	 *
	 * @param {WebGLRenderingContext} gl
	 */
	static free(gl) {
		if (texture) {
			gl.deleteTexture(texture);
			texture = null;
		}

		if (shaderProgram) {
			gl.deleteProgram(shaderProgram);
			shaderProgram = null;
		}

		if (vertexBuffer) {
			gl.deleteBuffer(vertexBuffer);
			vertexBuffer = null;
		}

		JoystickLockOnTarget.ready = false;
	}
}

/*
 * Static flags required by the renderer.
 */
JoystickLockOnTarget.ready = false;
JoystickLockOnTarget.renderBeforeEntities = true;

export default JoystickLockOnTarget;
