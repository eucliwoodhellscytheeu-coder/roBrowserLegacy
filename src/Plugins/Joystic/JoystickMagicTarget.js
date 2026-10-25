/**
 * Renderer/Effects/JoystickMagicTarget.js
 *
 * Converted from AMD (RequireJS define) to an ES module.
 */

import WebGL from 'Utils/WebGL.js';
import Texture from 'Utils/Texture.js';
import glMatrix from 'Utils/gl-matrix.js';
import SkillConst from 'DB/Skills/SkillConst.js';
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

// Skill size lookup table
const SkillSizes = {};

SkillSizes[SkillConst.MG_SAFETYWALL] = [3];
SkillSizes[SkillConst.CR_SLIMPITCHER] = [7];
SkillSizes[SkillConst.SO_ARRULLO] = [3, 3, 5, 5, 7];
SkillSizes[SkillConst.AC_SHOWER] = [3, 3, 3, 3, 3, 5, 5, 5, 5, 5];
SkillSizes[SkillConst.NC_ARMSCANNON] = [7, 5, 3];
SkillSizes[SkillConst.AM_DEMONSTRATION] = [3];
SkillSizes[SkillConst.SC_BLOODYLUST] = [7];
SkillSizes[SkillConst.PF_FOGWALL] = [3];
SkillSizes[SkillConst.PR_BENEDICTIO] = [3];
SkillSizes[SkillConst.KO_ZENKAI] = [5];
SkillSizes[SkillConst.WL_CRIMSONROCK] = [7];
SkillSizes[SkillConst.GN_CRAZYWEED] = [9];
SkillSizes[SkillConst.NPC_COMET] = [3];
SkillSizes[SkillConst.WL_COMET] = [26];
SkillSizes[SkillConst.HT_CLAYMORETRAP] = [5];
SkillSizes[SkillConst.SC_CHAOSPANIC] = [5];
SkillSizes[SkillConst.RK_DRAGONBREATH_WATER] = [9];
SkillSizes[SkillConst.RK_DRAGONBREATH] = [9];
SkillSizes[SkillConst.SC_DIMENSIONDOOR] = [1];
SkillSizes[SkillConst.SO_DIAMONDDUST] = [9];
SkillSizes[SkillConst.HT_DETECTING] = [3];
SkillSizes[SkillConst.GN_DEMONIC_FIRE] = [5];
SkillSizes[SkillConst.SA_DELUGE] = [7];
SkillSizes[SkillConst.SO_VACUUM_EXTREME] = [3, 3, 5, 5, 7];
SkillSizes[SkillConst.NPC_EVILLAND] = [11];
SkillSizes[SkillConst.AB_EPICLESIS] = [5];
SkillSizes[SkillConst.SO_EARTH_INSIGNIA] = [3];
SkillSizes[SkillConst.SO_EARTHGRAVE] = [9];
SkillSizes[SkillConst.HT_FLASHER] = [3];
SkillSizes[SkillConst.MG_FIREWALL] = [3];
SkillSizes[SkillConst.RA_FIRINGTRAP] = [5];
SkillSizes[SkillConst.SO_FIRE_INSIGNIA] = [3];
SkillSizes[SkillConst.GN_FIRE_EXPANSION] = [5];
SkillSizes[SkillConst.GN_HELLS_PLANT] = [3];
SkillSizes[SkillConst.WZ_HEAVENDRIVE] = [5];
SkillSizes[SkillConst.HW_GRAVITATION] = [5];
SkillSizes[SkillConst.RL_HAMMER_OF_GOD] = [5];
SkillSizes[SkillConst.NPC_RAYOFGENESIS] = [3];
SkillSizes[SkillConst.LG_RAYOFGENESIS] = [11];
SkillSizes[SkillConst.HW_GANBANTEIN] = [3];
SkillSizes[SkillConst.NC_COLDSLOWER] = [5, 7, 9];
SkillSizes[SkillConst.WZ_VERMILION] = [11];
SkillSizes[SkillConst.SR_RIDEINLIGHTNING] = [3, 3, 5, 5, 7];
SkillSizes[SkillConst.NJ_RAIGEKISAI] = [3, 3, 5, 5, 7];
SkillSizes[SkillConst.MH_LAVA_SLIDE] = [3, 3, 3, 5, 5, 5, 7, 7, 7, 9];
SkillSizes[SkillConst.NPC_MAGMA_ERUPTION] = [3];
SkillSizes[SkillConst.NC_MAGMA_ERUPTION] = [7];
SkillSizes[SkillConst.KO_BAKURETSU] = [3];
SkillSizes[SkillConst.NPC_CLOUD_KILL] = [3];
SkillSizes[SkillConst.SO_CLOUD_KILL] = [7];
SkillSizes[SkillConst.WZ_METEOR] = [7];
SkillSizes[SkillConst.SC_MANHOLE] = [3];
SkillSizes[SkillConst.PR_MAGNUS] = [7];
SkillSizes[SkillConst.SA_LANDPROTECTOR] = [9];
SkillSizes[SkillConst.SC_MAELSTROM] = [5];
SkillSizes[SkillConst.KO_MUCHANAGE] = [3, 3, 3, 3, 3, 3, 3, 3, 5];
SkillSizes[SkillConst.WZ_QUAGMIRE] = [5];
SkillSizes[SkillConst.NPC_PSYCHIC_WAVE] = [3];
SkillSizes[SkillConst.SO_PSYCHIC_WAVE] = [7, 7, 9, 9, 11];
SkillSizes[SkillConst.GC_POISONSMOKE] = [5];
SkillSizes[SkillConst.MH_POISON_MIST] = [7];
SkillSizes[SkillConst.AL_PNEUMA] = [3];
SkillSizes[SkillConst.LG_OVERBRAND] = [3];
SkillSizes[SkillConst.WM_SEVERE_RAINSTORM] = [11];
SkillSizes[SkillConst.RG_GRAFFITI] = [5];
SkillSizes[SkillConst.PR_SANCTUARY] = [5];
SkillSizes[SkillConst.MG_THUNDERSTORM] = [5];
SkillSizes[SkillConst.WZ_STORMGUST] = [11];
SkillSizes[SkillConst.WM_SOUND_OF_DESTRUCTION] = [9, 9, 11, 13, 15];
SkillSizes[SkillConst.WM_POEMOFNETHERWORLD] = [3];
SkillSizes[SkillConst.MH_XENO_SLASHER] = [3, 3, 3, 5, 5, 5, 7, 7, 7, 9];
SkillSizes[SkillConst.SO_WIND_INSIGNIA] = [3];
SkillSizes[SkillConst.SA_VIOLENTGALE] = [7];
SkillSizes[SkillConst.NJ_SUITON] = [3, 3, 3, 5, 5, 5, 7, 7, 7, 9];
SkillSizes[SkillConst.SO_WATER_INSIGNIA] = [3];
SkillSizes[SkillConst.SO_WARMER] = [7];
SkillSizes[SkillConst.SA_VOLCANO] = [7];
SkillSizes[SkillConst.MH_VOLCANIC_ASH] = [3];
SkillSizes[SkillConst.AS_VENOMDUST] = [2];
SkillSizes[SkillConst.KO_HUUMARANKA] = [7];

/**
 * Magic Target Effect Class
 */
class JoystickMagicTarget {
	static getSize(id, level = 1) {
		const sizes = SkillSizes[id];
		return sizes ? sizes[Math.min(Math.max(level, 1), sizes.length) - 1] : null;
	}
	/**
	 * @param {number} type Target type
	 * @param {number} id Skill ID
	 * @param {Array} pos Base position [x, y]
	 * @param {Array} offset Offset vector [dx, dy]
	 * @param {number} range Range limit
	 * @param {number} endLifeTime Expiration timestamp
	 * @param {object} [ownerEntity] Entity instance owning the skill
	 */
	constructor(type, id, pos, offset, range, endLifeTime, ownerEntity, level) {
		this.type = type;
		this.id = id;
		this.pos = pos;
		this.offset = offset;
		this.range = range;
		this.endLifeTime = endLifeTime;

		const entity = Session ? Session.Entity : null;

		// Determine ground circle size based on skill level or default
		if (SkillSizes[id]) {
			if (level) {
				this.size = SkillSizes[id][Math.min(level, SkillSizes[id].length) - 1] || 1;
			} else if (
				entity &&
				entity === ownerEntity &&
				id === entity.lastSKID &&
				entity.lastSkLvl &&
				SkillSizes[id].length >= entity.lastSkLvl
			) {
				this.size = SkillSizes[id][entity.lastSkLvl - 1] || 1;
			} else {
				this.size = SkillSizes[id][0] || 1;
			}
		} else {
			this.size = 1;
		}

		this.ready = false;
		this.needCleanUp = false;
	}

	/**
	 * Initialize instance state.
	 */
	init() {
		this.ready = true;
	}

	/**
	 * Free instance state.
	 */
	free() {
		this.ready = false;
	}

	/**
	 * Render the magic target circle.
	 *
	 * @param {WebGLRenderingContext} gl
	 * @param {number} currentTime
	 */
	render(gl, currentTime) {
		if (this.cancelled) {
			this.needCleanUp = true;
			return;
		}
		if (!shaderProgram || !JoystickMagicTarget.ready || !this.ready) {
			return;
		}

		let color = 1;
		const targetPos = new Float32Array(3);

		if (this.type === 1) {
			targetPos[0] = this.pos[0];
			targetPos[1] = this.pos[1];
			targetPos[2] = Altitude.getCellHeight(targetPos[0], targetPos[1]);

			gl.uniform3fv(shaderProgram.uniform.uPosition, targetPos);
			gl.uniform1f(shaderProgram.uniform.uSize, this.size);
			gl.uniform1f(shaderProgram.uniform.uColor, color);
			gl.drawArrays(gl.TRIANGLES, 0, 6);

			this.needCleanUp = this.endLifeTime < currentTime;
		} else {
			targetPos[0] = this.pos[0] + this.offset[0];
			targetPos[1] = this.pos[1] + this.offset[1];
			targetPos[2] = Altitude.getCellHeight(targetPos[0], targetPos[1]);

			const effectiveRange = this.range + 1;

			const playerPos =
				Session && Session.Entity && Session.Entity.position ? Session.Entity.position : [0, 0, 0];

			const dx = playerPos[0] - targetPos[0];
			const dy = playerPos[1] - targetPos[1];

			if (effectiveRange * effectiveRange <= dx * dx + dy * dy) {
				color = 0.2;
			}

			gl.uniform3fv(shaderProgram.uniform.uPosition, targetPos);
			gl.uniform1f(shaderProgram.uniform.uSize, this.size);
			gl.uniform1f(shaderProgram.uniform.uColor, color);
			gl.drawArrays(gl.TRIANGLES, 0, 6);

			this.needCleanUp = false;
		}
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
			console.error("JoystickMagicTarget.init: 'Client' module unavailable.");
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
                vec4 position = vec4(uPosition.x + 0.5, -uPosition.z, uPosition.y + 0.5, 1.0);
                position += vec4(aPosition.x * uSize, 0.0, aPosition.y * uSize, 0.0) * uRotationMat;

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
                vec4 texColor = texture(uDiffuse, vTextureCoord.st);

                if (texColor.a == 0.0) {
                    discard;
                }

                fragColor = texColor;
                fragColor.gb *= uColor;

                if (uFogUse) {
                    float depth = gl_FragCoord.z / gl_FragCoord.w;
                    float fogFactor = smoothstep(uFogNear, uFogFar, depth);
                    fragColor = mix(fragColor, vec4(uFogColor, fragColor.w), fogFactor);
                }
            }
            `
		);

		vertexBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([
				-0.5, -0.5, 0, 0, 0.5, -0.5, 1, 0, 0.5, 0.5, 1, 1, 0.5, 0.5, 1, 1, -0.5, 0.5, 0, 1, -0.5, -0.5, 0, 0
			]),
			gl.STATIC_DRAW
		);

		ClientModule.loadFile('data/texture/effect/magic_target.tga', image => {
			Texture.load(image, function () {
				const ctx = this.getContext('2d');
				ctx.save();
				ctx.translate(this.width / 2, this.height / 2);
				ctx.rotate(0.25 * Math.PI);
				ctx.translate(-this.width / 2, -this.height / 2);
				ctx.drawImage(this, 0, 0);
				ctx.restore();

				texture = gl.createTexture();
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

				JoystickMagicTarget.ready = true;
			});
		});
	}

	/**
	 * Pre-render setup before drawing targets.
	 */
	static beforeRender(gl, modelViewMatrix, projectionMatrix, fog, time) {
		if (!shaderProgram || !JoystickMagicTarget.ready) {
			return;
		}

		const uniforms = shaderProgram.uniform;
		const attributes = shaderProgram.attribute;

		mat4.identity(rotationMatrix);
		mat4.rotateY(rotationMatrix, rotationMatrix, (((time / 1000) * 100) / 180) * Math.PI);

		gl.useProgram(shaderProgram);
		gl.uniformMatrix4fv(uniforms.uModelViewMat, false, modelViewMatrix);
		gl.uniformMatrix4fv(uniforms.uProjectionMat, false, projectionMatrix);
		gl.uniformMatrix4fv(uniforms.uRotationMat, false, rotationMatrix);

		gl.uniform1i(uniforms.uFogUse, fog && fog.use && fog.exist ? 1 : 0);
		gl.uniform1f(uniforms.uFogNear, fog ? fog.near : 0);
		gl.uniform1f(uniforms.uFogFar, fog ? fog.far : 0);
		gl.uniform3fv(uniforms.uFogColor, fog && fog.color ? fog.color : [0, 0, 0]);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.uniform1i(uniforms.uDiffuse, 0);

		gl.enableVertexAttribArray(attributes.aPosition);
		gl.enableVertexAttribArray(attributes.aTextureCoord);

		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
		gl.vertexAttribPointer(attributes.aPosition, 2, gl.FLOAT, false, 16, 0);
		gl.vertexAttribPointer(attributes.aTextureCoord, 2, gl.FLOAT, false, 16, 8);
	}

	/**
	 * Post-render cleanup.
	 */
	static afterRender(gl) {
		if (!shaderProgram || !JoystickMagicTarget.ready) {
			return;
		}

		gl.disableVertexAttribArray(shaderProgram.attribute.aPosition);
		gl.disableVertexAttribArray(shaderProgram.attribute.aTextureCoord);
	}

	/**
	 * Free shared WebGL resources.
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

		JoystickMagicTarget.ready = false;
	}
}

// Static properties
JoystickMagicTarget.ready = false;
JoystickMagicTarget.renderBeforeEntities = true;

export default JoystickMagicTarget;
