const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const angleDelta = value => ((((value + 180) % 360) + 360) % 360) - 180;

function metrics(touches) {
	const [a, b] = touches;
	return {
		x: (a.clientX + b.clientX) / 2,
		y: (a.clientY + b.clientY) / 2,
		distance: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
		angle: (Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * 180) / Math.PI
	};
}

/**two-finger gestures, with stable touch IDs and start-relative pinch zoom. */
export class CameraGestures {
	constructor(camera, getLimits, getViewport) {
		this.camera = camera;
		this.getLimits = getLimits;
		this.getViewport = getViewport;
		this.state = null;
	}
	begin(touches) {
		const pair = Array.from(touches).slice(0, 2);
		if (pair.length < 2) {
			return;
		}
		const start = metrics(pair);
		this.camera.rotate(false);
		this.state = {
			ids: pair.map(touch => touch.identifier),
			start,
			lastAngle: start.angle,
			twist: 0,
			yaw: this.camera.angleFinal[1],
			pitch: this.camera.angleFinal[0],
			zoom: this.camera.zoomFinal,
			mode: null
		};
	}
	move(touches) {
		const state = this.state;
		if (!state) {
			return;
		}
		const pair = state.ids.map(id => Array.from(touches).find(touch => touch.identifier === id));
		if (pair.some(touch => !touch)) {
			this.begin(touches);
			return;
		}
		const current = metrics(pair);
		state.twist += angleDelta(current.angle - state.lastAngle);
		state.lastAngle = current.angle;
		const dx = current.x - state.start.x;
		const dy = current.y - state.start.y;
		const pinch = current.distance - state.start.distance;
		const limits = this.getLimits();
		const viewport = this.getViewport();
		if (!state.mode && Math.hypot(dx, dy) > 10 && Math.abs(pinch) < 10 && Math.abs(state.twist) < 5) {
			state.mode = Math.abs(dy) > Math.abs(dx) ? 'tilt' : 'rotate';
		}
		let yaw = state.yaw + state.twist * 2;
		if (state.mode === 'rotate') {
			yaw = state.yaw - (dx / Math.max(1, viewport.width)) * 720;
		} else if (state.mode === 'tilt') {
			this.camera.angleFinal[0] = clamp(
				state.pitch + (dy / Math.max(1, viewport.height)) * 300,
				limits.pitchMin,
				limits.pitchMax
			);
		}
		if (limits.yawMin !== undefined) {
			yaw = clamp(yaw, limits.yawMin, limits.yawMax);
		} else if (this.camera.angle[1] > 180 && yaw > 180) {
			this.camera.angle[1] -= 360;
			state.yaw -= 360;
			yaw -= 360;
		} else if (this.camera.angle[1] < -180 && yaw < -180) {
			this.camera.angle[1] += 360;
			state.yaw += 360;
			yaw += 360;
		}
		this.camera.angleFinal[1] = yaw;
		// Relative to gesture start: repeated events at one distance cannot keep zooming.
		this.camera.zoomFinal = clamp(state.zoom - pinch * 0.1, limits.zoomMin, limits.zoomMax);
		this.camera.updateState();
	}
	end() {
		if (this.state) {
			this.camera.rotate(false);
			this.camera.save();
			this.state = null;
		}
	}
}
