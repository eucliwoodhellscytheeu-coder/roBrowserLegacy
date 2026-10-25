import Session from 'Engine/SessionStorage.js';
import ShortCut from 'UI/Components/ShortCut/ShortCut.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import SkillTargetSelection from 'UI/Components/SkillTargetSelection/SkillTargetSelection.js';
import UIManager from 'UI/UIManager.js';
import EntityManager from 'Renderer/EntityManager.js';
import Entity from 'Renderer/Entity/Entity.js';
import Camera from 'Renderer/Camera.js';
import Altitude from 'Renderer/Map/Altitude.js';
import EffectManager from 'Renderer/EffectManager.js';
import SkillInfo from 'DB/Skills/SkillInfo.js';
import JoystickMagicTarget from './JoystickMagicTarget.js';
import JoystickLockOnTarget from './JoystickLockOnTarget.js';
import { AimController } from './AimController.js';

function makeVisual(state) {
	const level = state.slot.count || state.skill.level;
	const range =
		SkillInfo[state.slot.ID]?.AttackRange?.[level - 1] ?? state.skill.attackRange ?? state.player.attack_range;
	const ground = state.skill.type & (SkillTargetSelection.TYPE.PLACE | SkillTargetSelection.TYPE.TRAP);
	const effects = [];
	const params = {
		Inst: { ownerAID: state.player.GID, effectId: -1 },
		Init: { ownerAID: state.player.GID, effectId: -1 }
	};
	if (ground || JoystickMagicTarget.getSize(state.slot.ID, level) > 1) {
		const ring = new JoystickMagicTarget(0, state.slot.ID, state.anchor, state.offset, range, null, null, level);
		effects.push(ring);
		EffectManager.add(ring, params);
	}
	if (!ground) {
		const lock = new JoystickLockOnTarget(0, state.anchor, state.offset, range, null, null);
		effects.push(lock);
		EffectManager.add(lock, params);
	}
	return {
		update(current) {
			for (const effect of effects) {
				if (effect instanceof JoystickMagicTarget) {
					effect.pos = current.anchor;
				} else {
					effect.src = current.anchor;
				}
			}
		},
		remove() {
			for (const effect of effects) {
				effect.cancelled = true;
				effect.needCleanUp = true;
			}
		}
	};
}

export default function installShortcutTargeting(root, stopMove) {
	const blocked = () =>
		Session.FreezeUI ||
		['NpcStore', 'NpcBox', 'NpcMenu', 'WarpList'].some(name => UIManager.components[name]?.__active);
	const aim = new AimController({
		session: Session,
		shortcuts: ShortCut,
		inventory: Inventory,
		targets: SkillTargetSelection,
		entities: EntityManager,
		types: Entity,
		altitude: Altitude,
		makeVisual
	});
	let pointer = null;
	let button = null;
	const finish = cast => {
		const previousButton = button;
		const previousPointer = pointer;
		button = null;
		pointer = null;
		previousButton?.classList.remove('aiming');
		if (cast) {
			aim.release();
		} else {
			aim.cancel();
		}
		if (previousPointer !== null && previousButton?.hasPointerCapture(previousPointer)) {
			previousButton.releasePointerCapture(previousPointer);
		}
	};
	root.addEventListener('joystic-clear-slot', event => {
		if (button && Number(button.dataset.slot) === event.detail) {
			finish(false);
		}
	});
	root.querySelector('#shortcuts').addEventListener('pointerdown', event => {
		const target = event.target.closest('[data-slot]');
		if (!target || pointer !== null || event.button !== 0 || !Session.Entity || blocked()) {
			return;
		}
		const slot = ShortCut.getList()[Number(target.dataset.slot)];
		if (!slot?.ID) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		stopMove();
		if (SkillTargetSelection.__active) {
			SkillTargetSelection.remove();
		}
		if (aim.begin(slot, event.clientX, event.clientY)) {
			pointer = event.pointerId;
			button = target;
			button.setPointerCapture(pointer);
			button.classList.add('aiming');
		}
	});
	root.addEventListener('pointermove', event => {
		if (event.pointerId === pointer) {
			event.preventDefault();
			aim.move(event.clientX, event.clientY, Camera);
		}
	});
	for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
		root.addEventListener(type, event => {
			if (event.pointerId === pointer) {
				event.preventDefault();
				event.stopPropagation();
				finish(type === 'pointerup');
			}
		});
	}
	root.querySelector('#shortcuts').addEventListener('click', event => {
		const target = event.target.closest('[data-slot]');
		if (target && event.detail === 0 && Session.Entity && !blocked()) {
			// Keep keyboard activation's normal map-targeting flow.
			const slot = ShortCut.getList()[Number(target.dataset.slot)];
			if (slot?.isSkill) {
				SkillTargetSelection.remove();
				ShortCut.useSkill(slot.ID, slot.count);
			} else if (slot?.ID) {
				const item = Inventory.getItemById(slot.ID);
				if (item) {
					Inventory.useItem(item);
				}
			}
		}
	});
	return {
		cancel: () => finish(false),
		update() {
			if (blocked()) {
				finish(false);
				return;
			}
			aim.update();
			if (pointer !== null && !aim.state) {
				finish(false);
			}
		}
	};
}
