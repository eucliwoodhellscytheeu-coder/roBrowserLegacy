import { screenVectorToMap } from './CameraView.js';

// MobileUI uses a 15-pixel dead zone on a 45-pixel-radius joystick.
export const DEAD_ZONE = 15 / 45;
export const MOVE_INTERVAL = 100;
const TILE_SIZE = 3;

/** MobileUI-style analog target: no growing route or queued ray extensions. */
export function destination(position, vector, camera, altitude, viewport, occupied = () => false) {
	const length = Math.hypot(...vector);
	if (length < DEAD_ZONE) {
		return null;
	}
	const direction = screenVectorToMap(position, vector, camera, viewport);
	const magnitude = Math.min(length, 1);
	const target = direction.map((value, index) => Math.round(position[index] + value * magnitude * TILE_SIZE));
	const free = (x, y) => !!(altitude.getCellType(x, y) & altitude.TYPE.WALKABLE) && !occupied(x, y);
	const dx = position[0] < target[0] ? -1 : 1;
	const dy = position[1] < target[1] ? -1 : 1;
	// Same nearby-free-cell search as MobileUI.checkFreeCell.
	for (let radius = 0; radius <= 5; radius++) {
		for (let x = -radius; x <= radius; x++) {
			for (let y = -radius; y <= radius; y++) {
				const candidate = [target[0] + x * dx, target[1] + y * dy];
				if (free(...candidate)) {
					return candidate;
				}
			}
		}
	}
	return null;
}

export class JoystickWalk {
	constructor() {
		this.reset();
	}
	reset() {
		this.pending = null;
		this.lastCheck = -Infinity;
	}
	next(position, vector, camera, altitude, now, viewport, occupied) {
		if (Math.hypot(...vector) < DEAD_ZONE) {
			this.reset();
			return null;
		}
		if (now - this.lastCheck < MOVE_INTERVAL) {
			return null;
		}
		this.lastCheck = Number.isFinite(this.lastCheck) ? now - ((now - this.lastCheck) % MOVE_INTERVAL) : now;
		const next = destination(position, vector, camera, altitude, viewport, occupied);
		if (!next || (this.pending && this.pending[0] === next[0] && this.pending[1] === next[1])) {
			return null;
		}
		this.pending = next;
		return [...next];
	}
}
