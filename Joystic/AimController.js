export function screenToAim(dx, dy, cameraAngle) {
	const angle = ((typeof cameraAngle === 'number' ? cameraAngle : cameraAngle.angle[1]) * Math.PI) / 180;
	return [(dx * Math.cos(angle) + dy * Math.sin(angle)) / 5, (dx * Math.sin(angle) - dy * Math.cos(angle)) / 5];
}

export class AimController {
	constructor(services) {
		Object.assign(this, services);
		this.state = null;
	}
	valid(entity) {
		return (
			entity && !entity.isDeath && !entity.isHide && !entity.remove_tick && entity.action !== entity.ACTION.DIE
		);
	}
	begin(slot, x, y) {
		this.cancel();
		const player = this.session.Entity;
		if (!player || !slot?.ID) {
			return false;
		}
		if (!slot.isSkill) {
			this.state = { mode: 'item', slot: { ...slot }, player };
			return true;
		}
		const skill = this.shortcuts.getSkillById(slot.ID);
		if (!skill?.level || !skill.type) {
			return false;
		}
		const touchTargeting = this.session.TouchTargeting;
		this.session.TouchTargeting = false;
		try {
			this.shortcuts.useSkill(slot.ID, slot.count);
		} finally {
			this.session.TouchTargeting = touchTargeting;
		}
		if (!(skill.type & this.targets.TYPE.TARGET) || !this.targets.__active) {
			this.state = { mode: 'instant', player };
			return true;
		}
		let target = player;
		if (skill.type & (this.targets.TYPE.ENEMY | this.targets.TYPE.PLACE | this.targets.TYPE.TRAP)) {
			target = null;
			const focused = this.entities.getFocusEntity();
			if (this.valid(focused) && focused.objecttype === this.types.TYPE_MOB) {
				target = focused;
			} else {
				let nearest = Infinity;
				this.entities.forEach(entity => {
					if (this.valid(entity) && entity.objecttype === this.types.TYPE_MOB) {
						const distance = Math.hypot(
							entity.position[0] - player.position[0],
							entity.position[1] - player.position[1]
						);
						if (distance < nearest) {
							nearest = distance;
							target = entity;
						}
					}
					return true;
				});
			}
		}
		this.state = {
			mode: 'aim',
			slot: { ...slot },
			player,
			skill,
			target,
			anchor: (target || player).position,
			offset: [0, 0],
			point: [x, y],
			start: [x, y],
			dragged: false
		};
		this.visual = this.makeVisual?.(this.state);
		this.update();
		return true;
	}
	move(x, y, cameraAngle) {
		const state = this.state;
		if (state?.mode !== 'aim') {
			return;
		}
		if (!state.dragged) {
			state.dragged = true;
			state.anchor = state.player.position;
		}
		const [dx, dy] = screenToAim(x - state.point[0], y - state.point[1], cameraAngle);
		state.offset[0] += dx;
		state.offset[1] += dy;
		state.point = [x, y];
		this.update();
	}
	update() {
		const state = this.state;
		if (!state) {
			return;
		}
		if (
			state.player !== this.session.Entity ||
			!this.valid(state.player) ||
			(state.mode === 'aim' && !this.targets.__active)
		) {
			this.cancel();
			return;
		}
		if (state.mode !== 'aim') {
			return;
		}
		state.position = [state.anchor[0] + state.offset[0], state.anchor[1] + state.offset[1]];
		if (state.dragged) {
			state.target = null;
			this.entities.forEach(entity => {
				if (state.target) {
					return false;
				}
				const halfWidth = (entity.xSize || 1) / 2;
				const halfHeight = (entity.ySize || 1) / 2;
				if (
					this.valid(entity) &&
					this.accepts(entity, state.skill.type) &&
					state.position[0] > entity.position[0] - halfWidth &&
					state.position[0] < entity.position[0] + halfHeight &&
					state.position[1] > entity.position[1] - halfHeight &&
					state.position[1] < entity.position[1] + halfHeight
				) {
					state.target = entity;
					return false;
				}
				return true;
			});
		}
		this.entities.setOverEntity(state.target);
		this.visual?.update(state);
	}
	accepts(entity, flags) {
		const type = entity.objecttype;
		const masks = this.targets.TYPE;
		if (entity === this.session.Entity && flags & masks.ENEMY) {
			return false;
		}
		return !!(
			(flags & (masks.ENEMY | masks.PET) &&
				[this.types.TYPE_MOB, this.types.TYPE_UNIT, this.types.TYPE_PET].includes(type)) ||
			(flags & masks.FRIEND &&
				[this.types.TYPE_PC, this.types.TYPE_HOM, this.types.TYPE_MERC, this.types.TYPE_ELEM].includes(type)) ||
			(flags & masks.TRAP && type === this.types.TYPE_TRAP) ||
			this.targets.checkMapState?.(entity)
		);
	}
	release() {
		this.update();
		const state = this.state;
		if (!state) {
			return;
		}
		try {
			if (state.mode === 'item') {
				const item = this.inventory.getItemById(state.slot.ID);
				if (item) {
					this.inventory.useItem(item);
				}
			} else if (state.mode === 'aim') {
				if (state.skill.type & this.targets.TYPE.PLACE) {
					const [x, y] = state.position;
					if (x >= 0 && y >= 0 && x < this.altitude.width && y < this.altitude.height) {
						this.targets.onUseSkillToPos(state.slot.ID, state.slot.count || state.skill.level, x, y);
					}
				} else if (this.valid(state.target)) {
					this.targets.intersectEntityId(state.target.GID);
				}
			}
		} finally {
			this.cancel();
		}
	}
	cancel() {
		const aiming = this.state?.mode === 'aim';
		this.state = null;
		this.visual?.remove();
		this.visual = null;
		if (aiming) {
			this.entities.setOverEntity(null);
			this.targets.remove();
		}
	}
}
