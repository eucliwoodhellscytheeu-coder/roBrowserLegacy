/** Keep a steady gait when short joystick paths are acknowledged mid-stride. */
export class WalkContinuity {
	constructor() {
		this.player = null;
		this.destinations = new Set();
	}
	track(player, destination) {
		if (player !== this.player) {
			this.stop();
			this.player = player;
			this.original = player.walkTo;
			const original = this.original;
			const continuity = this;
			this.wrapper = function walkTo(...args) {
				const key = `${args[2]},${args[3]}`;
				const owned = continuity.destinations.delete(key);
				const before = [this.position[0], this.position[1]];
				const walk = this.walk;
				let continuing = false;
				if (
					owned &&
					walk.total > walk.index &&
					this.action === this.ACTION.WALK &&
					!this.isFastMoving &&
					!args[7]
				) {
					const previous = [walk.path[walk.total - 2] - before[0], walk.path[walk.total - 1] - before[1]];
					const next = [args[2] - before[0], args[3] - before[1]];
					const length = Math.hypot(...previous) * Math.hypot(...next);
					continuing = length > 0 && (previous[0] * next[0] + previous[1] * next[1]) / length > 0.9;
				}
				const result = original.apply(this, args);
				// Native relocation, fallback snapping, combat and forced moves always win.
				if (
					continuing &&
					this.action === this.ACTION.WALK &&
					!this.isFastMoving &&
					walk.total >= 4 &&
					this.position[0] === before[0] &&
					this.position[1] === before[1]
				) {
					for (let index = 2; index < walk.total; index += 2) {
						const x = index === 2 ? before[0] : walk.path[index - 2];
						const y = index === 2 ? before[1] : walk.path[index - 1];
						const dx = walk.path[index] - x;
						const dy = walk.path[index + 1] - y;
						const distance = index > 2 && dx && dy ? 1.414 : Math.hypot(dx, dy);
						walk.segmentDurations[(index - 2) / 2] = distance * walk.speed;
					}
					walk.tick = walk.prevTick = Date.now();
				}
				return result;
			};
			player.walkTo = this.wrapper;
		}
		this.destinations.add(destination.join(','));
		if (this.destinations.size > 32) {
			this.destinations.delete(this.destinations.values().next().value);
		}
	}
	stop() {
		if (this.player && this.player.walkTo === this.wrapper) {
			this.player.walkTo = this.original;
		}
		this.player = null;
		this.destinations.clear();
	}
}
